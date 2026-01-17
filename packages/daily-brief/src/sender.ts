/**
 * Daily Brief Email Sender
 * Sends emails via SendGrid
 */

import sgMail from '@sendgrid/mail';
import type { BriefData } from './template.js';
import { generateHtmlEmail, generateTextEmail, generateSubject } from './template.js';

/**
 * SendGrid configuration
 */
export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Email send result
 */
export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let isConfigured = false;

/**
 * Configure SendGrid with API key
 */
export function configureSendGrid(config: SendGridConfig): void {
  sgMail.setApiKey(config.apiKey);
  isConfigured = true;
}

/**
 * Send daily brief email to a single recipient
 */
export async function sendBriefEmail(
  recipient: string,
  data: BriefData,
  config: SendGridConfig
): Promise<SendResult> {
  if (!isConfigured) {
    configureSendGrid(config);
  }

  try {
    const subject = generateSubject(data);
    const html = generateHtmlEmail(data);
    const text = generateTextEmail(data);

    const msg = {
      to: recipient,
      from: {
        email: config.fromEmail,
        name: config.fromName,
      },
      subject,
      text,
      html,
      categories: ['daily-brief', data.appName],
      customArgs: {
        app_id: data.appName,
        brief_date: data.date,
      },
    };

    const [response] = await sgMail.send(msg);

    return {
      success: true,
      messageId: response.headers['x-message-id']?.toString(),
    };
  } catch (error) {
    console.error('[Daily Brief] SendGrid error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send daily brief email to multiple recipients
 */
export async function sendBriefToRecipients(
  recipients: string[],
  data: BriefData,
  config: SendGridConfig
): Promise<{ sent: number; failed: number; results: Record<string, SendResult> }> {
  if (!isConfigured) {
    configureSendGrid(config);
  }

  const results: Record<string, SendResult> = {};
  let sent = 0;
  let failed = 0;

  // Send emails in parallel with a concurrency limit
  const batchSize = 10;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((recipient) => sendBriefEmail(recipient, data, config))
    );

    batch.forEach((recipient, index) => {
      const result = batchResults[index];
      results[recipient] = result;
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    });
  }

  return { sent, failed, results };
}

/**
 * Send a test/preview email
 */
export async function sendTestBrief(
  recipient: string,
  data: BriefData,
  config: SendGridConfig
): Promise<SendResult> {
  // Modify subject to indicate this is a test
  const testData = {
    ...data,
    appName: `[TEST] ${data.appName}`,
  };

  return sendBriefEmail(recipient, testData, config);
}
