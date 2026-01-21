/**
 * Email Service
 * Sends transactional emails via SendGrid
 */

import sgMail from '@sendgrid/mail';
import { config } from '../config.js';
import type { Issue, App } from '@britepulse/shared';

let isConfigured = false;

/**
 * Configure SendGrid with API key
 */
function ensureConfigured(): boolean {
  if (!config.sendgridApiKey) {
    console.warn('[Email] SendGrid API key not configured');
    return false;
  }
  if (!isConfigured) {
    sgMail.setApiKey(config.sendgridApiKey);
    isConfigured = true;
  }
  return true;
}

/**
 * Send result type
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Generate HTML email for issue resolved notification
 */
function generateResolvedEmailHtml(issue: Issue, app: App): string {
  const issueUrl = `${config.consoleBaseUrl}/issues/${issue.issue_id}`;
  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${issueTypeLabel} Has Been Resolved</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">✓ Issue Resolved</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi there,</p>

    <p>Great news! Your ${issueTypeLabel.toLowerCase()} for <strong>${app.name}</strong> has been resolved.</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #374151;">${issueTypeLabel}</strong>
      </p>
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">${issue.title}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${issue.description.substring(0, 200)}${issue.description.length > 200 ? '...' : ''}</p>
    </div>

    <p>Thank you for taking the time to report this. Your feedback helps us improve ${app.name}!</p>

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
      — The ${app.name} Team
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">Powered by <a href="https://britepulse.io" style="color: #6b7280;">BritePulse</a></p>
  </div>
</body>
</html>
`;
}

/**
 * Generate plain text email for issue resolved notification
 */
function generateResolvedEmailText(issue: Issue, app: App): string {
  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  return `
Issue Resolved

Hi there,

Great news! Your ${issueTypeLabel.toLowerCase()} for ${app.name} has been resolved.

${issueTypeLabel}: ${issue.title}

${issue.description.substring(0, 300)}${issue.description.length > 300 ? '...' : ''}

Thank you for taking the time to report this. Your feedback helps us improve ${app.name}!

— The ${app.name} Team

---
Powered by BritePulse
`.trim();
}

/**
 * Send notification email when an issue is resolved
 */
export async function sendResolvedNotification(
  issue: Issue,
  app: App
): Promise<SendResult> {
  // Check if we have a reporter email
  if (!issue.reported_by?.email) {
    return {
      success: false,
      error: 'No reporter email available',
    };
  }

  if (!ensureConfigured()) {
    return {
      success: false,
      error: 'SendGrid not configured',
    };
  }

  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  try {
    const msg = {
      to: issue.reported_by.email,
      from: {
        email: config.sendgridFromEmail,
        name: app.name,
      },
      subject: `Your ${issueTypeLabel} Has Been Resolved - ${issue.title}`,
      text: generateResolvedEmailText(issue, app),
      html: generateResolvedEmailHtml(issue, app),
      categories: ['issue-resolved', app.app_id],
      customArgs: {
        issue_id: issue.issue_id,
        app_id: app.app_id,
      },
    };

    const [response] = await sgMail.send(msg);

    console.log(`[Email] Sent resolved notification to ${issue.reported_by.email} for issue ${issue.issue_id}`);

    return {
      success: true,
      messageId: response.headers['x-message-id']?.toString(),
    };
  } catch (error) {
    console.error('[Email] SendGrid error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
