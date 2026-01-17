/**
 * Daily Brief Service
 * Exports for the daily brief email functionality
 */

export * from './selector.js';
export * from './template.js';
export * from './sender.js';

import type { Issue, App } from '@britepulse/shared';
import { selectIssuesForBrief, SelectionConfig, DEFAULT_SELECTION_CONFIG } from './selector.js';
import { generateHtmlEmail, generateTextEmail, generateSubject, BriefData } from './template.js';
import { sendBriefToRecipients, SendGridConfig } from './sender.js';

/**
 * Configuration for generating and sending daily briefs
 */
export interface DailyBriefConfig {
  sendgrid: SendGridConfig;
  consoleUrl: string;
  selection?: SelectionConfig;
}

/**
 * Result of running daily brief for an app
 */
export interface DailyBriefResult {
  appId: string;
  appName: string;
  issuesSelected: number;
  recipientsSent: number;
  recipientsFailed: number;
  errors: string[];
}

/**
 * Generate brief data for an app
 */
export function generateBriefData(
  app: App,
  issues: Issue[],
  config: DailyBriefConfig,
  stats: {
    totalEvents24h: number;
    newIssues24h: number;
    resolvedIssues24h: number;
  }
): BriefData {
  const rankedIssues = selectIssuesForBrief(issues, config.selection || DEFAULT_SELECTION_CONFIG);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    appName: app.name,
    date: dateStr,
    consoleUrl: config.consoleUrl,
    issues: rankedIssues,
    stats: {
      totalIssues24h: issues.filter(
        (i) => i.status !== 'resolved'
      ).length,
      totalEvents24h: stats.totalEvents24h,
      newIssues24h: stats.newIssues24h,
      resolvedIssues24h: stats.resolvedIssues24h,
    },
  };
}

/**
 * Run daily brief for a single app
 */
export async function runDailyBriefForApp(
  app: App,
  issues: Issue[],
  config: DailyBriefConfig,
  stats: {
    totalEvents24h: number;
    newIssues24h: number;
    resolvedIssues24h: number;
  }
): Promise<DailyBriefResult> {
  const result: DailyBriefResult = {
    appId: app.app_id,
    appName: app.name,
    issuesSelected: 0,
    recipientsSent: 0,
    recipientsFailed: 0,
    errors: [],
  };

  try {
    // Check if daily brief is enabled for this app
    const schedule = app.schedules;
    if (!schedule) {
      result.errors.push('No schedule configuration');
      return result;
    }

    // Get recipients
    const recipients = schedule.daily_brief_recipients || [];
    if (recipients.length === 0) {
      // Fall back to PO emails from owners
      const poEmails = app.owners?.po_emails || [];
      if (poEmails.length === 0) {
        result.errors.push('No recipients configured');
        return result;
      }
      recipients.push(...poEmails);
    }

    // Generate brief data
    const briefData = generateBriefData(app, issues, config, stats);
    result.issuesSelected = briefData.issues.length;

    // Send to all recipients
    const sendResults = await sendBriefToRecipients(recipients, briefData, config.sendgrid);
    result.recipientsSent = sendResults.sent;
    result.recipientsFailed = sendResults.failed;

    // Collect any errors
    for (const [email, sendResult] of Object.entries(sendResults.results)) {
      if (!sendResult.success && sendResult.error) {
        result.errors.push(`${email}: ${sendResult.error}`);
      }
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * Preview daily brief HTML without sending
 */
export function previewDailyBrief(
  app: App,
  issues: Issue[],
  config: DailyBriefConfig,
  stats: {
    totalEvents24h: number;
    newIssues24h: number;
    resolvedIssues24h: number;
  }
): { subject: string; html: string; text: string } {
  const briefData = generateBriefData(app, issues, config, stats);

  return {
    subject: generateSubject(briefData),
    html: generateHtmlEmail(briefData),
    text: generateTextEmail(briefData),
  };
}
