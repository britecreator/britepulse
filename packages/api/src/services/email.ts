/**
 * Email Service
 * Sends transactional emails via SendGrid
 */

import sgMail from '@sendgrid/mail';
import { config } from '../config.js';
import type { Issue, App, IssueComment } from '@britepulse/shared';

let isConfigured = false;

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
function generateResolvedEmailHtml(issue: Issue, app: App, resolutionNote?: string): string {
  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  // Escape user-supplied content to prevent HTML injection
  const safeAppName = escapeHtml(app.name);
  const safeTitle = escapeHtml(issue.title);
  const safeDescription = escapeHtml(issue.description.substring(0, 200));
  const descriptionEllipsis = issue.description.length > 200 ? '...' : '';

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

    <p>Great news! Your ${issueTypeLabel.toLowerCase()} for <strong>${safeAppName}</strong> has been resolved.</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #374151;">${issueTypeLabel}</strong>
      </p>
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">${safeTitle}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${safeDescription}${descriptionEllipsis}</p>
    </div>

    ${resolutionNote ? `
    <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #065f46;">Note from the team:</p>
      <p style="margin: 0; color: #374151; font-size: 14px;">${escapeHtml(resolutionNote)}</p>
    </div>
    ` : ''}

    <p>Thank you for taking the time to report this. Your feedback helps us improve ${safeAppName}!</p>

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
      — The ${safeAppName} Team
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
function generateResolvedEmailText(issue: Issue, app: App, resolutionNote?: string): string {
  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  return `
Issue Resolved

Hi there,

Great news! Your ${issueTypeLabel.toLowerCase()} for ${app.name} has been resolved.

${issueTypeLabel}: ${issue.title}

${issue.description.substring(0, 300)}${issue.description.length > 300 ? '...' : ''}
${resolutionNote ? `\nNote from the team:\n${resolutionNote}\n` : ''}
Thank you for taking the time to report this. Your feedback helps us improve ${app.name}!

— The ${app.name} Team

---
Powered by BritePulse
`.trim();
}

/**
 * Generate HTML email for issue won't fix notification
 */
function generateWontFixEmailHtml(issue: Issue, app: App, resolutionNote?: string): string {
  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  // Escape user-supplied content to prevent HTML injection
  const safeAppName = escapeHtml(app.name);
  const safeTitle = escapeHtml(issue.title);
  const safeDescription = escapeHtml(issue.description.substring(0, 200));
  const descriptionEllipsis = issue.description.length > 200 ? '...' : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Update on Your ${issueTypeLabel}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Update on Your Report</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi there,</p>

    <p>Thank you for taking the time to submit your ${issueTypeLabel.toLowerCase()} for <strong>${safeAppName}</strong>. We appreciate your feedback and the effort you put into reporting this.</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #374151;">${issueTypeLabel}</strong>
      </p>
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #111827;">${safeTitle}</h2>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">${safeDescription}${descriptionEllipsis}</p>
    </div>

    ${resolutionNote ? `
    <div style="background: #f9fafb; border-left: 4px solid #6b7280; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #374151;">Note from the team:</p>
      <p style="margin: 0; color: #374151; font-size: 14px;">${escapeHtml(resolutionNote)}</p>
    </div>
    ` : `
    <p>After careful review, we've determined that this issue will not be addressed at this time. This could be due to various factors such as current priorities, technical constraints, or alignment with our product direction.</p>
    `}

    <p>We understand this may not be the outcome you were hoping for, and we genuinely value your input. If you have any questions or would like to discuss this further, please don't hesitate to reach out.</p>

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
      — The ${safeAppName} Team
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
 * Generate plain text email for issue won't fix notification
 */
function generateWontFixEmailText(issue: Issue, app: App, resolutionNote?: string): string {
  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  return `
Update on Your Report

Hi there,

Thank you for taking the time to submit your ${issueTypeLabel.toLowerCase()} for ${app.name}. We appreciate your feedback and the effort you put into reporting this.

${issueTypeLabel}: ${issue.title}

${issue.description.substring(0, 300)}${issue.description.length > 300 ? '...' : ''}
${resolutionNote ? `\nNote from the team:\n${resolutionNote}\n` : `\nAfter careful review, we've determined that this issue will not be addressed at this time. This could be due to various factors such as current priorities, technical constraints, or alignment with our product direction.\n`}
We understand this may not be the outcome you were hoping for, and we genuinely value your input. If you have any questions or would like to discuss this further, please don't hesitate to reach out.

— The ${app.name} Team

---
Powered by BritePulse
`.trim();
}

/**
 * Send notification email when an issue is marked as won't fix
 */
export async function sendWontFixNotification(
  issue: Issue,
  app: App,
  resolutionNote?: string
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
      subject: `Update on Your ${issueTypeLabel} - ${issue.title}`,
      text: generateWontFixEmailText(issue, app, resolutionNote),
      html: generateWontFixEmailHtml(issue, app, resolutionNote),
      categories: ['issue-wont-fix', app.app_id],
      customArgs: {
        issue_id: issue.issue_id,
        app_id: app.app_id,
      },
    };

    const [response] = await sgMail.send(msg);

    console.log(`[Email] Sent won't fix notification to ${issue.reported_by.email} for issue ${issue.issue_id}`);

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

/**
 * Send notification email when an issue is resolved
 */
export async function sendResolvedNotification(
  issue: Issue,
  app: App,
  resolutionNote?: string
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
      text: generateResolvedEmailText(issue, app, resolutionNote),
      html: generateResolvedEmailHtml(issue, app, resolutionNote),
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

/**
 * Send notification email when a comment is added to an issue
 * Includes Reply-To header for inbound email replies
 */
export async function sendCommentNotification(
  issue: Issue,
  app: App,
  comment: IssueComment
): Promise<SendResult> {
  if (!issue.reported_by?.email) {
    return { success: false, error: 'No reporter email available' };
  }

  if (!ensureConfigured()) {
    return { success: false, error: 'SendGrid not configured' };
  }

  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  const safeAppName = escapeHtml(app.name);
  const safeTitle = escapeHtml(issue.title);
  const safeBody = escapeHtml(comment.body);
  const safeAuthor = escapeHtml(comment.author_name || comment.author_email);

  // Reply-to address encodes the issue ID for inbound parse routing
  const replyToAddress = `issue+${issue.issue_id}@${config.inboundEmailDomain || 'reply.britepulse.io'}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Comment on Your ${issueTypeLabel}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">New Comment</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi there,</p>

    <p>There's a new comment on your ${issueTypeLabel.toLowerCase()} for <strong>${safeAppName}</strong>:</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #374151;">${issueTypeLabel}:</strong> ${safeTitle}
      </p>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 12px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
          <strong>${safeAuthor}</strong> commented:
        </p>
        <p style="margin: 0; color: #111827; font-size: 14px; white-space: pre-wrap;">${safeBody}</p>
      </div>
    </div>

    <p>You can reply directly to this email to add a comment back.</p>

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
      — The ${safeAppName} Team
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">Powered by <a href="https://britepulse.io" style="color: #6b7280;">BritePulse</a></p>
  </div>
</body>
</html>
`;

  const text = `
New Comment on Your ${issueTypeLabel}

Hi there,

There's a new comment on your ${issueTypeLabel.toLowerCase()} for ${app.name}:

${issueTypeLabel}: ${issue.title}

${comment.author_name || comment.author_email} commented:
${comment.body}

You can reply directly to this email to add a comment back.

— The ${app.name} Team

---
Powered by BritePulse
`.trim();

  try {
    const msg = {
      to: issue.reported_by.email,
      from: {
        email: config.sendgridFromEmail,
        name: app.name,
      },
      replyTo: {
        email: replyToAddress,
        name: `${app.name} Issue Discussion`,
      },
      subject: `Re: Your ${issueTypeLabel} - ${issue.title}`,
      text,
      html,
      categories: ['issue-comment', app.app_id],
      customArgs: {
        issue_id: issue.issue_id,
        app_id: app.app_id,
        comment_id: comment.comment_id,
      },
    };

    const [response] = await sgMail.send(msg);

    console.log(`[Email] Sent comment notification to ${issue.reported_by.email} for issue ${issue.issue_id}`);

    return {
      success: true,
      messageId: response.headers['x-message-id']?.toString(),
    };
  } catch (error) {
    console.error('[Email] SendGrid comment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse @mentions from a comment body.
 * Matches @user@domain.tld patterns where the leading @ is the mention sigil.
 * Returns deduplicated array of lowercase email addresses.
 */
export function parseMentions(body: string): string[] {
  const mentionRegex = /(?:^|\s)@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const mentions = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = mentionRegex.exec(body)) !== null) {
    mentions.add(match[1].toLowerCase());
  }
  return Array.from(mentions);
}

/**
 * Send notification email to a team member who was @mentioned in a comment.
 * Unlike sendCommentNotification, this does NOT include a Reply-To header
 * and instead links to the console.
 */
export async function sendTeamMentionNotification(
  issue: Issue,
  app: App,
  comment: IssueComment,
  recipientEmail: string
): Promise<SendResult> {
  if (!ensureConfigured()) {
    return { success: false, error: 'SendGrid not configured' };
  }

  const issueTypeLabel = issue.issue_type === 'bug' ? 'Bug Report' :
                         issue.issue_type === 'feedback' ? 'Feedback' :
                         issue.issue_type === 'feature' ? 'Feature Request' : 'Issue';

  const safeAppName = escapeHtml(app.name);
  const safeTitle = escapeHtml(issue.title);
  const safeBody = escapeHtml(comment.body);
  const safeAuthor = escapeHtml(comment.author_name || comment.author_email);
  const consoleUrl = `${config.consoleBaseUrl}/issues/${issue.issue_id}`;
  const replyToAddress = `issue+${issue.issue_id}@${config.inboundEmailDomain || 'reply.britepulse.io'}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You were mentioned in a comment</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">You Were Mentioned</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="margin-top: 0;">Hi there,</p>

    <p>You were mentioned in a comment on a ${issueTypeLabel.toLowerCase()} for <strong>${safeAppName}</strong>:</p>

    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #374151;">${issueTypeLabel}:</strong> ${safeTitle}
      </p>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 12px;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280;">
          <strong>${safeAuthor}</strong> commented:
        </p>
        <p style="margin: 0; color: #111827; font-size: 14px; white-space: pre-wrap;">${safeBody}</p>
      </div>
    </div>

    <p>You can reply directly to this email to add a comment, or <a href="${consoleUrl}" style="color: #2563eb; text-decoration: underline;">view this issue in the BritePulse console</a>.</p>

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">
      — The ${safeAppName} Team
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">Powered by <a href="https://britepulse.io" style="color: #6b7280;">BritePulse</a></p>
  </div>
</body>
</html>
`;

  const text = `
You Were Mentioned

Hi there,

You were mentioned in a comment on a ${issueTypeLabel.toLowerCase()} for ${app.name}:

${issueTypeLabel}: ${issue.title}

${comment.author_name || comment.author_email} commented:
${comment.body}

You can reply directly to this email to add a comment, or view this issue in the BritePulse console: ${consoleUrl}

— The ${app.name} Team

---
Powered by BritePulse
`.trim();

  try {
    const msg = {
      to: recipientEmail,
      from: {
        email: config.sendgridFromEmail,
        name: app.name,
      },
      replyTo: {
        email: replyToAddress,
        name: `${app.name} Issue Discussion`,
      },
      subject: `You were mentioned: ${issue.title}`,
      text,
      html,
      categories: ['issue-mention', app.app_id],
      customArgs: {
        issue_id: issue.issue_id,
        app_id: app.app_id,
        comment_id: comment.comment_id,
      },
    };

    const [response] = await sgMail.send(msg);

    console.log(`[Email] Sent mention notification to ${recipientEmail} for issue ${issue.issue_id}`);

    return {
      success: true,
      messageId: response.headers['x-message-id']?.toString(),
    };
  } catch (error) {
    console.error('[Email] SendGrid mention error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
