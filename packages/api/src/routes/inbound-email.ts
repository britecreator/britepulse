/**
 * Inbound Email Webhook Route
 * Handles SendGrid Inbound Parse webhook for email replies to issue comments
 */

import { Router, type IRouter } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import * as firestoreService from '../services/firestore.js';

const router: IRouter = Router();

// SendGrid Inbound Parse sends multipart form data
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Extract the issue ID from the "to" email address
 * Expected format: issue+{issue_id}@reply.britepulse.io
 */
function extractIssueId(toAddress: string): string | null {
  // Parse multiple recipients; find the one matching our pattern
  const addresses = toAddress.split(',').map((a) => a.trim());
  for (const addr of addresses) {
    // Strip display name if present: "Name <email>" -> "email"
    const emailMatch = addr.match(/<([^>]+)>/) || [null, addr];
    const email = (emailMatch[1] || '').toLowerCase();
    const match = email.match(/^issue\+([a-f0-9-]+)@/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extract the sender email from the "from" field
 */
function extractSenderEmail(fromField: string): string | null {
  const emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
  const email = (emailMatch[1] || '').trim().toLowerCase();
  return email.includes('@') ? email : null;
}

/**
 * Strip quoted reply text from email body
 * Returns only the new content written by the replier
 */
function stripQuotedReply(text: string): string {
  const lines = text.split('\n');
  const cutoffPatterns = [
    /^-{3,}/, // --- separator
    /^on .+ wrote:$/i, // "On ... wrote:"
    /^>/, // Quoted line
    /^_{3,}/, // ___ separator
    /^From:.*$/i, // Forwarded header
    /^Sent:.*$/i,
    /^To:.*$/i,
    /^Subject:.*$/i,
  ];

  const newLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Stop at the first line that looks like quoted text
    if (cutoffPatterns.some((p) => p.test(trimmed))) {
      break;
    }
    newLines.push(line);
  }

  return newLines.join('\n').trim();
}

/**
 * POST /webhooks/inbound-email
 * Receives SendGrid Inbound Parse webhook
 * Authenticated via query string token (not OAuth)
 */
router.post(
  '/',
  upload.none(), // Parse multipart form data (no file fields expected)
  async (req, res) => {
    try {
      // Authenticate webhook
      const token = req.query.token as string;
      if (!config.inboundEmailSecret || token !== config.inboundEmailSecret) {
        console.warn('[InboundEmail] Invalid or missing webhook token');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // SendGrid sends these fields in the form body:
      const { from, to, text } = req.body;

      if (!from || !to || !text) {
        console.warn('[InboundEmail] Missing required fields:', { from: !!from, to: !!to, text: !!text });
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      // Extract issue ID from the "to" address
      const issueId = extractIssueId(to);
      if (!issueId) {
        console.warn('[InboundEmail] Could not extract issue ID from:', to);
        res.status(400).json({ error: 'Invalid recipient address' });
        return;
      }

      // Extract sender email
      const senderEmail = extractSenderEmail(from);
      if (!senderEmail) {
        console.warn('[InboundEmail] Could not extract sender email from:', from);
        res.status(400).json({ error: 'Invalid sender' });
        return;
      }

      // Look up the issue
      const issue = await firestoreService.getIssue(issueId);
      if (!issue) {
        console.warn('[InboundEmail] Issue not found:', issueId);
        // Return 200 to prevent SendGrid from retrying
        res.status(200).json({ status: 'ignored', reason: 'issue_not_found' });
        return;
      }

      // Validate sender is either the issue reporter or a known team member
      const isReporter = issue.reported_by?.email?.toLowerCase() === senderEmail;
      let isTeamMember = false;
      if (!isReporter) {
        const allUsers = await firestoreService.getAllUsers();
        isTeamMember = allUsers.some((u) => u.email.toLowerCase() === senderEmail);
      }

      if (!isReporter && !isTeamMember) {
        console.warn('[InboundEmail] Sender not authorized:', {
          sender: senderEmail,
          reporter: issue.reported_by?.email,
        });
        // Return 200 to prevent retries
        res.status(200).json({ status: 'ignored', reason: 'sender_mismatch' });
        return;
      }

      // Strip quoted reply text
      const body = stripQuotedReply(text);
      if (!body) {
        console.warn('[InboundEmail] Empty reply body after stripping quotes');
        res.status(200).json({ status: 'ignored', reason: 'empty_body' });
        return;
      }

      // Create comment from email reply
      const comment = await firestoreService.createComment(issueId, {
        issue_id: issueId,
        author_email: senderEmail,
        body,
        source: 'email',
      });

      console.log(`[InboundEmail] Created comment ${comment.comment_id} on issue ${issueId} from ${senderEmail}`);

      res.status(200).json({ status: 'ok', comment_id: comment.comment_id });
    } catch (error) {
      console.error('[InboundEmail] Error processing inbound email:', error);
      // Return 200 to prevent SendGrid from retrying on errors
      res.status(200).json({ status: 'error' });
    }
  }
);

export default router;
