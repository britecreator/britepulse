/**
 * AI Context File Generator
 * Creates markdown artifacts for external AI agent consumption
 *
 * Design: Hybrid approach - includes aggregated metrics and factual observations,
 * but omits root cause hypothesis and fix suggestions so the developer's AI agent
 * can analyze from scratch with full codebase context.
 */

import type { Issue, Event, App } from '@britepulse/shared';

/**
 * Check if issue is an error/bug type
 */
function isErrorIssue(issue: Issue): boolean {
  return issue.issue_type === 'bug';
}

/**
 * Check if issue is feedback/feature type
 */
function isFeedbackIssue(issue: Issue): boolean {
  return issue.issue_type === 'feedback' || issue.issue_type === 'feature' || issue.issue_type === 'question';
}

export interface ContextFileData {
  issue: Issue;
  events: Event[];
  app: App;
}

/**
 * Generate a markdown context file for an issue
 * This file is designed to be copied into an AI coding assistant
 */
export function generateContextFile(data: ContextFileData): string {
  const { issue, events, app } = data;
  const lines: string[] = [];

  // Header
  lines.push(`# Issue Context: ${issue.title}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Issue Summary
  lines.push('## Issue Summary');
  lines.push(`- **ID:** ${issue.issue_id}`);
  lines.push(`- **App:** ${app.name} (${issue.environment})`);
  lines.push(`- **Type:** ${issue.issue_type}`);
  lines.push(`- **Severity:** ${issue.severity}`);
  lines.push(`- **Status:** ${issue.status}`);
  lines.push(`- **Created:** ${issue.timestamps.created_at}`);
  // Only show Last Seen if different from Created (avoids redundancy)
  if (issue.timestamps.last_seen_at !== issue.timestamps.created_at) {
    lines.push(`- **Last Seen:** ${issue.timestamps.last_seen_at}`);
  }
  lines.push('');

  // Metrics (only meaningful for errors with multiple occurrences)
  if (isErrorIssue(issue) && issue.counts.occurrences_total > 1) {
    lines.push('## Metrics');
    lines.push(`- **Total Occurrences:** ${issue.counts.occurrences_total}`);
    lines.push(`- **24h Occurrences:** ${issue.counts.occurrences_24h}`);
    lines.push(`- **Unique Users (24h est):** ${issue.counts.unique_users_24h_est}`);
    lines.push('');
  }

  // Description
  lines.push('## Description');
  lines.push(issue.description);
  lines.push('');

  // Reported By (if known)
  if (issue.reported_by?.email || issue.reported_by?.user_id) {
    lines.push('## Reported By');
    if (issue.reported_by.email) {
      lines.push(`- **Email:** ${issue.reported_by.email}`);
    }
    if (issue.reported_by.user_id && issue.reported_by.user_id !== 'anonymous') {
      lines.push(`- **User ID:** ${issue.reported_by.user_id}`);
    }
    lines.push('');
  }

  // Pattern Observations (only meaningful for errors with patterns)
  if (isErrorIssue(issue)) {
    const patterns = extractPatterns(events);
    if (patterns.length > 0) {
      lines.push('## Pattern Observations');
      patterns.forEach((p) => lines.push(`- ${p}`));
      lines.push('');
    }
  }

  // Affected Routes
  const routes = extractUniqueRoutes(events);
  if (routes.length > 0) {
    lines.push('## Affected Routes');
    routes.forEach((r) => lines.push(`- ${r}`));
    lines.push('');
  }

  // Affected Versions
  const versions = extractUniqueVersions(events);
  if (versions.length > 0) {
    lines.push('## Affected Versions');
    versions.forEach((v) => lines.push(`- ${v}`));
    lines.push('');
  }

  // User Feedback (if any)
  const feedback = extractUserFeedback(events);
  if (feedback.length > 0) {
    lines.push('## User Feedback');
    feedback.forEach((f, i) => {
      lines.push(`### Feedback ${i + 1}`);
      lines.push(f);
      lines.push('');
    });
  }

  // Recent Events (only show if there are error events)
  const errorEvents = events.filter(
    (e) => e.event_type === 'frontend_error' || e.event_type === 'backend_error'
  );

  if (errorEvents.length > 0) {
    lines.push('## Recent Events');
    lines.push('');

    errorEvents.slice(0, 10).forEach((event, i) => {
      lines.push(`### Event ${i + 1} (${event.event_type})`);
      lines.push(`- **Timestamp:** ${event.timestamp}`);
      lines.push(`- **Route:** ${event.route_or_url}`);
      // Only show version if known
      if (event.version && event.version !== 'unknown') {
        lines.push(`- **Version:** ${event.version}`);
      }

      if (event.user?.user_id && event.user.user_id !== 'anonymous') {
        lines.push(`- **User Role:** ${event.user.role || 'unknown'}`);
      }
      lines.push('');

      const payload = event.payload as unknown as Record<string, unknown>;

      // Error type observation (factual, not hypothesis)
      if (payload.error_type) {
        lines.push(`**Error Type:** ${payload.error_type}`);
        lines.push('');
      }

      // Error message
      if (payload.message) {
        lines.push(`**Message:** ${payload.message}`);
        lines.push('');
      }

      // Stack trace
      if (payload.stack) {
        lines.push('**Stack Trace:**');
        lines.push('```');
        lines.push(String(payload.stack).split('\n').slice(0, 25).join('\n'));
        lines.push('```');
        lines.push('');
      }

      // Component stack (React)
      if (payload.component_stack) {
        lines.push('**Component Stack (React):**');
        lines.push('```');
        lines.push(String(payload.component_stack).split('\n').slice(0, 15).join('\n'));
        lines.push('```');
        lines.push('');
      }

      // Source location
      if (payload.source_file) {
        lines.push(`**Source:** ${payload.source_file}:${payload.line_number || '?'}:${payload.column_number || '?'}`);
        lines.push('');
      }
    });
  }

  // Instructions for AI Agent (dynamic based on issue type)
  lines.push('---');
  lines.push('## Instructions for AI Agent');
  lines.push('');
  lines.push('You have been provided with context about an issue from our monitoring system.');
  lines.push('');

  if (isFeedbackIssue(issue)) {
    // Feature/Feedback instructions
    lines.push('**Your task:**');
    lines.push("1. Understand the user's request and their context (page, workflow)");
    lines.push('2. Search the codebase to identify where this feature would be implemented');
    lines.push('3. Propose an implementation approach with specific files to modify');
    lines.push('4. Consider UX implications and edge cases');
    lines.push('5. Suggest tests to verify the implementation');
    lines.push('');
    lines.push('**If you need additional context, ask for:**');
    lines.push('- Current implementation of related features');
    lines.push('- UI/UX patterns used in the app');
    lines.push('- API schemas if backend changes are needed');
    lines.push('- Design system components available');
  } else {
    // Error/Bug instructions
    lines.push('**Your task:**');
    lines.push('1. Analyze the stack traces and error patterns');
    lines.push('2. Search the codebase to identify the root cause');
    lines.push('3. Propose a fix with specific code changes');
    lines.push('4. Suggest tests to verify the fix');
    lines.push('');
    lines.push('**If you need additional context, ask for:**');
    lines.push('- Specific file contents mentioned in stack traces');
    lines.push('- Related component or module code');
    lines.push('- API/database schemas if relevant');
    lines.push('- Recent changes to affected files');
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Extract factual pattern observations from events
 */
function extractPatterns(events: Event[]): string[] {
  const patterns: string[] = [];

  // Check if all events are on the same route
  const routes = new Set(events.map((e) => e.route_or_url));
  if (routes.size === 1 && events.length > 1) {
    patterns.push(`All ${events.length} occurrences on route: ${[...routes][0]}`);
  }

  // Check version distribution
  const versions = new Set(events.map((e) => e.version).filter((v) => v !== 'unknown'));
  if (versions.size === 1 && events.length > 1) {
    patterns.push(`All occurrences in version: ${[...versions][0]}`);
  } else if (versions.size > 1) {
    patterns.push(`Affects multiple versions: ${[...versions].join(', ')}`);
  }

  // Check error type consistency
  const errorTypes = new Set(
    events
      .filter((e) => e.event_type !== 'feedback')
      .map((e) => (e.payload as unknown as Record<string, unknown>).error_type as string)
      .filter(Boolean)
  );
  if (errorTypes.size === 1) {
    patterns.push(`Consistent error type: ${[...errorTypes][0]}`);
  }

  // Check user impact
  const userIds = new Set(events.map((e) => e.user?.user_id).filter((id) => id && id !== 'anonymous'));
  if (userIds.size > 0) {
    patterns.push(`Affects ${userIds.size} identified user(s)`);
  }

  return patterns;
}

/**
 * Extract unique routes from events
 */
function extractUniqueRoutes(events: Event[]): string[] {
  const routes = new Set(events.map((e) => e.route_or_url).filter((r) => r && r !== 'unknown'));
  return [...routes].slice(0, 10);
}

/**
 * Extract unique versions from events
 */
function extractUniqueVersions(events: Event[]): string[] {
  const versions = new Set(events.map((e) => e.version).filter((v) => v && v !== 'unknown'));
  return [...versions].slice(0, 5);
}

/**
 * Extract user feedback from events
 */
function extractUserFeedback(events: Event[]): string[] {
  const feedback: string[] = [];

  events
    .filter((e) => e.event_type === 'feedback')
    .slice(0, 5)
    .forEach((event) => {
      const payload = event.payload as unknown as Record<string, unknown>;
      const parts: string[] = [];

      if (payload.category) {
        parts.push(`**Category:** ${payload.category}`);
      }
      if (payload.description) {
        parts.push(`**Description:** ${payload.description}`);
      }
      if (payload.reproduction_steps) {
        parts.push(`**Reproduction Steps:** ${payload.reproduction_steps}`);
      }

      if (parts.length > 0) {
        feedback.push(parts.join('\n'));
      }
    });

  return feedback;
}

/**
 * Generate context file as JSON (alternative format)
 */
export function generateContextJSON(data: ContextFileData): object {
  const { issue, events, app } = data;

  const errorEvents = events.filter(
    (e) => e.event_type === 'frontend_error' || e.event_type === 'backend_error'
  );

  // Build issue object with conditional fields
  const issueData: Record<string, unknown> = {
    id: issue.issue_id,
    title: issue.title,
    description: issue.description,
    type: issue.issue_type,
    severity: issue.severity,
    status: issue.status,
    environment: issue.environment,
    timestamps: {
      created_at: issue.timestamps.created_at,
      // Only include last_seen_at if different from created_at
      ...(issue.timestamps.last_seen_at !== issue.timestamps.created_at && {
        last_seen_at: issue.timestamps.last_seen_at,
      }),
    },
  };

  // Only include metrics for errors with multiple occurrences
  if (isErrorIssue(issue) && issue.counts.occurrences_total > 1) {
    issueData.metrics = {
      total_occurrences: issue.counts.occurrences_total,
      occurrences_24h: issue.counts.occurrences_24h,
      unique_users_24h: issue.counts.unique_users_24h_est,
    };
  }

  // Include reported_by if available
  if (issue.reported_by?.email || issue.reported_by?.user_id) {
    issueData.reported_by = {
      ...(issue.reported_by.email && { email: issue.reported_by.email }),
      ...(issue.reported_by.user_id && issue.reported_by.user_id !== 'anonymous' && {
        user_id: issue.reported_by.user_id,
      }),
    };
  }

  const result: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    issue: issueData,
    app: {
      id: app.app_id,
      name: app.name,
    },
    affected_routes: extractUniqueRoutes(events),
    user_feedback: extractUserFeedback(events),
  };

  // Only include patterns for errors
  if (isErrorIssue(issue)) {
    result.patterns = extractPatterns(events);
  }

  // Only include affected_versions if there are known versions
  const versions = extractUniqueVersions(events);
  if (versions.length > 0) {
    result.affected_versions = versions;
  }

  // Only include events if there are error events
  if (errorEvents.length > 0) {
    result.events = errorEvents.slice(0, 20).map((e) => ({
      id: e.event_id,
      type: e.event_type,
      timestamp: e.timestamp,
      route: e.route_or_url,
      ...(e.version && e.version !== 'unknown' && { version: e.version }),
      payload: e.payload,
    }));
  }

  // Include instruction type hint
  result.instruction_type = isFeedbackIssue(issue) ? 'feature_request' : 'bug_fix';

  return result;
}
