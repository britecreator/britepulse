/**
 * Evidence Gathering Module
 * Prepares sanitized context for AI triage
 */

import type {
  Issue,
  Event,
  AIAnalysisInput,
  CodeExcerpt,
} from '@britepulse/shared';

/**
 * Maximum items to include
 */
const LIMITS = {
  maxFeedback: 5,
  maxStackTraces: 3,
  maxCodeExcerpts: 5,
  maxRoutes: 10,
  maxVersions: 5,
};

/**
 * Build AI analysis input from issue and events
 */
export function buildAnalysisInput(
  issue: Issue,
  events: Event[],
  appName: string,
  options: {
    codeExcerpts?: CodeExcerpt[];
    previousOccurrences24h?: number;
  } = {}
): AIAnalysisInput {
  const { codeExcerpts = [], previousOccurrences24h } = options;

  // Calculate trend direction
  let trendDirection: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (previousOccurrences24h !== undefined && previousOccurrences24h > 0) {
    const change =
      ((issue.counts.occurrences_24h - previousOccurrences24h) / previousOccurrences24h) * 100;
    if (change > 10) trendDirection = 'increasing';
    else if (change < -10) trendDirection = 'decreasing';
  }

  // Extract feedback from events
  const feedbackEvents = events.filter((e) => e.event_type === 'feedback');
  const sanitizedFeedback = feedbackEvents
    .slice(0, LIMITS.maxFeedback)
    .map((e) => extractFeedbackText(e))
    .filter((f): f is string => f !== null);

  // Extract stack traces from error events
  const errorEvents = events.filter(
    (e) => e.event_type === 'frontend_error' || e.event_type === 'backend_error'
  );
  const sanitizedStackTraces = errorEvents
    .slice(0, LIMITS.maxStackTraces)
    .map((e) => extractStackTrace(e))
    .filter((s): s is string => s !== null);

  // Extract affected routes
  const routes = [...new Set(events.map((e) => e.route_or_url))].slice(0, LIMITS.maxRoutes);

  // Extract affected versions
  const versions = [...new Set(events.map((e) => e.version).filter((v) => v !== 'unknown'))].slice(
    0,
    LIMITS.maxVersions
  );

  return {
    issue_id: issue.issue_id,
    issue_title: issue.title,
    issue_description: issue.description,
    issue_type: issue.issue_type,
    current_severity: issue.severity,
    occurrences_total: issue.counts.occurrences_total,
    occurrences_24h: issue.counts.occurrences_24h,
    unique_users_24h_est: issue.counts.unique_users_24h_est,
    trend_direction: trendDirection,
    sanitized_feedback: sanitizedFeedback.length > 0 ? sanitizedFeedback : undefined,
    sanitized_stack_traces: sanitizedStackTraces.length > 0 ? sanitizedStackTraces : undefined,
    retrieved_code_excerpts: codeExcerpts.length > 0 ? codeExcerpts.slice(0, LIMITS.maxCodeExcerpts) : undefined,
    app_name: appName,
    environment: issue.environment,
    affected_routes: routes.length > 0 ? routes : undefined,
    affected_versions: versions.length > 0 ? versions : undefined,
  };
}

/**
 * Extract feedback text from an event
 */
function extractFeedbackText(event: Event): string | null {
  const payload = event.payload as unknown as Record<string, unknown>;
  const description = payload.description as string | undefined;
  const steps = payload.reproduction_steps as string | undefined;

  if (!description) return null;

  let text = description;
  if (steps) {
    text += `\n\nSteps to reproduce:\n${steps}`;
  }

  return text;
}

/**
 * Extract stack trace from an error event
 */
function extractStackTrace(event: Event): string | null {
  const payload = event.payload as unknown as Record<string, unknown>;
  const stack = payload.stack as string | undefined;

  if (!stack) return null;

  // Truncate very long stack traces
  const lines = stack.split('\n');
  if (lines.length > 20) {
    return lines.slice(0, 20).join('\n') + '\n... (truncated)';
  }

  return stack;
}

/**
 * Check if content is safe to send to AI
 * Based on Build Contract Section 10.1-10.2
 */
export function validateContentForAI(content: string): { safe: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for potential secrets
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/gi,
    /password\s*[:=]\s*['"]?[^\s'"]{8,}/gi,
    /secret\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/gi,
    /bearer\s+[a-zA-Z0-9._-]{20,}/gi,
    /token\s*[:=]\s*['"]?[a-zA-Z0-9._-]{20,}/gi,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      issues.push('Content may contain secrets or credentials');
      break;
    }
  }

  // Check for PII patterns
  const piiPatterns = [
    // SSN
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
    // Credit card
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/,
    // Phone (if not already redacted)
    /(?<!\[REDACTED)\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  ];

  for (const pattern of piiPatterns) {
    if (pattern.test(content)) {
      issues.push('Content may contain unredacted PII');
      break;
    }
  }

  return { safe: issues.length === 0, issues };
}

/**
 * Sanitize content for AI consumption
 */
export function sanitizeForAI(content: string): string {
  let sanitized = content;

  // Remove potential secrets
  sanitized = sanitized.replace(
    /(api[_-]?key|password|secret|token|bearer|authorization)\s*[:=]\s*['"]?[^\s'"]{16,}['"]?/gi,
    '$1=[REDACTED]'
  );

  // Remove remaining PII patterns
  sanitized = sanitized.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[REDACTED_SSN]');
  sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_CARD]');

  return sanitized;
}
