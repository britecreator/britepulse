/**
 * Daily Brief Email Template
 * Generates HTML and plain text emails for the daily brief
 */

import type { Severity } from '@britepulse/shared';
import type { RankedIssue } from './selector.js';

/**
 * Brief data for template rendering
 */
export interface BriefData {
  appName: string;
  date: string;
  consoleUrl: string;
  issues: RankedIssue[];
  stats: {
    totalIssues24h: number;
    totalEvents24h: number;
    newIssues24h: number;
    resolvedIssues24h: number;
  };
}

/**
 * Severity to color mapping
 */
const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; border: string }> = {
  P0: { bg: '#FEE2E2', text: '#991B1B', border: '#F87171' },
  P1: { bg: '#FFEDD5', text: '#9A3412', border: '#FB923C' },
  P2: { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
  P3: { bg: '#F3F4F6', text: '#374151', border: '#9CA3AF' },
};

/**
 * Format issue for display
 */
function formatIssueHtml(ranked: RankedIssue, consoleUrl: string): string {
  const issue = ranked.issue;
  const colors = SEVERITY_COLORS[issue.severity];
  const issueUrl = `${consoleUrl}/issues/${issue.issue_id}`;

  let aiSummary = '';
  if (issue.ai_analysis) {
    aiSummary = `
      <div style="margin-top: 8px; padding: 8px; background: #F5F3FF; border-left: 3px solid #8B5CF6; font-size: 13px;">
        <strong style="color: #6D28D9;">AI Analysis:</strong> ${escapeHtml(issue.ai_analysis.impact_summary)}
        <br/>
        <span style="color: #7C3AED;">Suggested action: ${escapeHtml(issue.ai_analysis.next_action)}</span>
      </div>
    `;
  }

  return `
    <div style="margin-bottom: 16px; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
      <div style="padding: 12px 16px; background: ${colors.bg}; border-bottom: 1px solid ${colors.border};">
        <span style="display: inline-block; padding: 2px 8px; background: ${colors.border}; color: white; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px;">
          ${issue.severity}
        </span>
        <a href="${issueUrl}" style="color: ${colors.text}; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${escapeHtml(issue.title)}
        </a>
      </div>
      <div style="padding: 12px 16px;">
        <p style="margin: 0 0 8px 0; color: #4B5563; font-size: 14px;">
          ${escapeHtml(issue.description || 'No description')}
        </p>
        <div style="display: flex; gap: 16px; font-size: 13px; color: #6B7280;">
          <span><strong>${issue.counts.occurrences_24h}</strong> events (24h)</span>
          <span><strong>${issue.counts.unique_users_24h_est}</strong> users affected</span>
          <span>Status: <strong>${formatStatus(issue.status)}</strong></span>
        </div>
        ${aiSummary}
      </div>
    </div>
  `;
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate HTML email content
 */
export function generateHtmlEmail(data: BriefData): string {
  const issuesHtml = data.issues.map((i) => formatIssueHtml(i, data.consoleUrl)).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BritePulse Daily Brief - ${data.appName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #1F2937; max-width: 600px; margin: 0 auto; padding: 20px;">

  <!-- Header -->
  <div style="text-align: center; padding: 24px 0; border-bottom: 2px solid #E5E7EB;">
    <h1 style="margin: 0; color: #4F46E5; font-size: 24px;">BritePulse Daily Brief</h1>
    <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 14px;">
      ${escapeHtml(data.appName)} - ${data.date}
    </p>
  </div>

  <!-- Summary Stats -->
  <div style="padding: 20px 0; border-bottom: 1px solid #E5E7EB;">
    <h2 style="margin: 0 0 12px 0; font-size: 16px; color: #374151;">24-Hour Summary</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 12px;">
      <div style="flex: 1; min-width: 120px; padding: 12px; background: #F3F4F6; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #4F46E5;">${data.stats.totalEvents24h}</div>
        <div style="font-size: 12px; color: #6B7280;">Total Events</div>
      </div>
      <div style="flex: 1; min-width: 120px; padding: 12px; background: #F3F4F6; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #4F46E5;">${data.stats.totalIssues24h}</div>
        <div style="font-size: 12px; color: #6B7280;">Active Issues</div>
      </div>
      <div style="flex: 1; min-width: 120px; padding: 12px; background: #DCFCE7; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #16A34A;">${data.stats.newIssues24h}</div>
        <div style="font-size: 12px; color: #6B7280;">New Issues</div>
      </div>
      <div style="flex: 1; min-width: 120px; padding: 12px; background: #DBEAFE; border-radius: 8px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #2563EB;">${data.stats.resolvedIssues24h}</div>
        <div style="font-size: 12px; color: #6B7280;">Resolved</div>
      </div>
    </div>
  </div>

  <!-- Priority Issues -->
  <div style="padding: 20px 0;">
    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #374151;">Priority Issues</h2>
    ${
      data.issues.length > 0
        ? issuesHtml
        : '<p style="color: #6B7280; text-align: center; padding: 24px;">No priority issues to report.</p>'
    }
  </div>

  <!-- CTA -->
  <div style="text-align: center; padding: 24px 0; border-top: 1px solid #E5E7EB;">
    <a href="${data.consoleUrl}" style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
      View All Issues in Console
    </a>
  </div>

  <!-- Footer -->
  <div style="text-align: center; padding: 16px 0; color: #9CA3AF; font-size: 12px;">
    <p style="margin: 0;">
      You're receiving this because you're a product owner for ${escapeHtml(data.appName)}.
    </p>
    <p style="margin: 8px 0 0 0;">
      <a href="${data.consoleUrl}/settings/notifications" style="color: #6B7280;">Manage notification preferences</a>
    </p>
  </div>

</body>
</html>
  `.trim();
}

/**
 * Generate plain text email content
 */
export function generateTextEmail(data: BriefData): string {
  const lines: string[] = [
    `BRITEPULSE DAILY BRIEF`,
    `${data.appName} - ${data.date}`,
    ``,
    `24-HOUR SUMMARY`,
    `---------------`,
    `Total Events: ${data.stats.totalEvents24h}`,
    `Active Issues: ${data.stats.totalIssues24h}`,
    `New Issues: ${data.stats.newIssues24h}`,
    `Resolved: ${data.stats.resolvedIssues24h}`,
    ``,
    `PRIORITY ISSUES`,
    `---------------`,
  ];

  if (data.issues.length === 0) {
    lines.push(`No priority issues to report.`);
  } else {
    for (const ranked of data.issues) {
      const issue = ranked.issue;
      lines.push(``);
      lines.push(`[${issue.severity}] ${issue.title}`);
      lines.push(`  ${issue.description || 'No description'}`);
      lines.push(`  Events: ${issue.counts.occurrences_24h} | Users: ${issue.counts.unique_users_24h_est} | Status: ${formatStatus(issue.status)}`);
      lines.push(`  View: ${data.consoleUrl}/issues/${issue.issue_id}`);
      if (issue.ai_analysis) {
        lines.push(`  AI Analysis: ${issue.ai_analysis.impact_summary}`);
        lines.push(`  Suggested: ${issue.ai_analysis.next_action}`);
      }
    }
  }

  lines.push(``);
  lines.push(`View all issues: ${data.consoleUrl}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(`You're receiving this because you're a product owner for ${data.appName}.`);
  lines.push(`Manage preferences: ${data.consoleUrl}/settings/notifications`);

  return lines.join('\n');
}

/**
 * Generate email subject
 */
export function generateSubject(data: BriefData): string {
  const { stats, issues } = data;

  // Count by severity
  let criticalCount = 0;
  let highCount = 0;
  for (const ranked of issues) {
    if (ranked.issue.severity === 'P0') criticalCount++;
    else if (ranked.issue.severity === 'P1') highCount++;
  }

  const parts: string[] = [`[${data.appName}]`];

  if (criticalCount > 0) {
    parts.push(`${criticalCount} Critical`);
  } else if (highCount > 0) {
    parts.push(`${highCount} High Priority`);
  } else if (stats.newIssues24h > 0) {
    parts.push(`${stats.newIssues24h} New Issues`);
  } else {
    parts.push(`Daily Brief`);
  }

  parts.push(`- ${data.date}`);

  return parts.join(' ');
}
