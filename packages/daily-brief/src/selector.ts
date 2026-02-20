/**
 * Daily Brief Issue Selector
 * Selects priority issues for the daily brief based on configurable criteria
 */

import type { Issue, Severity } from '@britepulse/shared';

/**
 * Configuration for issue selection
 */
export interface SelectionConfig {
  maxItems: number;
  minItems: number;
  minSeverity: Severity;
  includeResolved24h: boolean;
}

export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  maxItems: 10,
  minItems: 5,
  minSeverity: 'P3',  // Include all severities by default
  includeResolved24h: true,
};

/**
 * Issue with calculated priority for the brief
 */
export interface RankedIssue {
  issue: Issue;
  score: number;
  reason: string;
}

/**
 * Severity weights for scoring
 */
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  P0: 100,
  P1: 60,
  P2: 30,
  P3: 10,
};

/**
 * Calculate brief priority score for an issue
 */
function calculateBriefScore(issue: Issue): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Base severity score
  const severityScore = SEVERITY_WEIGHTS[issue.severity];
  score += severityScore;
  reasons.push(`severity ${issue.severity}`);

  // Recurrence bonus (capped at 50)
  const recurrenceScore = Math.min(issue.counts.occurrences_24h, 50);
  if (recurrenceScore > 10) {
    score += recurrenceScore;
    reasons.push(`${issue.counts.occurrences_24h} occurrences/24h`);
  }

  // User impact bonus (capped at 30)
  const userScore = Math.min(issue.counts.unique_users_24h_est * 3, 30);
  if (userScore > 5) {
    score += userScore;
    reasons.push(`${issue.counts.unique_users_24h_est} users affected`);
  }

  // New issue bonus
  const firstSeenTime = new Date(issue.timestamps.created_at).getTime();
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  if (firstSeenTime > twentyFourHoursAgo) {
    score += 20;
    reasons.push('new in last 24h');
  }

  // AI analysis bonus
  if (issue.ai_analysis) {
    score += 10;
    reasons.push('AI analyzed');
  }

  return {
    score,
    reason: reasons.join(', '),
  };
}

/**
 * Check if severity meets minimum threshold
 */
function meetsSeverityThreshold(severity: Severity, minSeverity: Severity): boolean {
  const order: Severity[] = ['P0', 'P1', 'P2', 'P3'];
  return order.indexOf(severity) <= order.indexOf(minSeverity);
}

/**
 * Select and rank issues for the daily brief
 */
export function selectIssuesForBrief(
  issues: Issue[],
  config: SelectionConfig = DEFAULT_SELECTION_CONFIG
): RankedIssue[] {
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  // Filter eligible issues
  const eligibleIssues = issues.filter((issue) => {
    // Must meet severity threshold
    if (!meetsSeverityThreshold(issue.severity, config.minSeverity)) {
      return false;
    }

    // Include resolved/wont_fix only if recently closed and configured
    if (issue.status === 'resolved' || issue.status === 'wont_fix') {
      if (!config.includeResolved24h) return false;
      const lastSeenTime = new Date(issue.timestamps.last_seen_at).getTime();
      if (lastSeenTime < twentyFourHoursAgo) return false;
    }

    return true;
  });

  // Rank all eligible issues
  const rankedIssues: RankedIssue[] = eligibleIssues.map((issue) => {
    const { score, reason } = calculateBriefScore(issue);
    return { issue, score, reason };
  });

  // Sort by score descending
  rankedIssues.sort((a, b) => b.score - a.score);

  // Take top items (up to maxItems, at least minItems if available)
  const count = Math.min(rankedIssues.length, config.maxItems);
  return rankedIssues.slice(0, count);
}

/**
 * Group selected issues by severity for display
 */
export function groupBySeverity(rankedIssues: RankedIssue[]): Record<Severity, RankedIssue[]> {
  const groups: Record<Severity, RankedIssue[]> = {
    P0: [],
    P1: [],
    P2: [],
    P3: [],
  };

  for (const item of rankedIssues) {
    groups[item.issue.severity].push(item);
  }

  return groups;
}

/**
 * Get a summary of the selection
 */
export function getSelectionSummary(rankedIssues: RankedIssue[]): string {
  const groups = groupBySeverity(rankedIssues);

  const parts: string[] = [];
  if (groups.P0.length > 0) parts.push(`${groups.P0.length} critical`);
  if (groups.P1.length > 0) parts.push(`${groups.P1.length} high`);
  if (groups.P2.length > 0) parts.push(`${groups.P2.length} medium`);
  if (groups.P3.length > 0) parts.push(`${groups.P3.length} low`);

  return `${rankedIssues.length} issues: ${parts.join(', ')}`;
}
