/**
 * Priority Scoring Service
 * Deterministic priority calculation per Build Contract Section 8
 */

import {
  SEVERITY_WEIGHTS,
  ENVIRONMENT_WEIGHTS,
  type Severity,
  type Issue,
} from '@britepulse/shared';

/**
 * Maximum caps for normalization (Section 8.3)
 */
const CAPS = {
  occurrences_24h: 100,
  unique_users_24h: 100,
  trend_velocity: 50,
};

/**
 * Priority score components breakdown
 */
export interface PriorityComponents {
  severity_component: number;
  environment_component: number;
  occurrences_component: number;
  users_component: number;
  trend_component: number;
  total_score: number;
}

/**
 * Calculate priority score for an issue
 * Formula from Section 8.4:
 * priority_score = severity_weight * environment_weight
 *                + occurrences_component
 *                + unique_users_component
 *                + trend_component
 */
export function calculatePriorityScore(
  issue: Pick<Issue, 'severity' | 'environment' | 'counts'>,
  previousOccurrences24h?: number
): PriorityComponents {
  // Severity weight (Section 8.1)
  const severityWeight = SEVERITY_WEIGHTS[issue.severity as Severity];

  // Environment weight (Section 8.2)
  const envWeight = ENVIRONMENT_WEIGHTS[issue.environment] ?? ENVIRONMENT_WEIGHTS.dev;

  // Base score (severity * environment)
  const baseScore = severityWeight * envWeight;

  // Occurrences component (normalized, capped at 100)
  const occurrencesNormalized = Math.min(issue.counts.occurrences_24h, CAPS.occurrences_24h);

  // Unique users component (normalized, capped at 100)
  const usersNormalized = Math.min(issue.counts.unique_users_24h_est, CAPS.unique_users_24h);

  // Trend velocity component (increase vs previous day, capped at 50)
  let trendVelocity = 0;
  if (previousOccurrences24h !== undefined && previousOccurrences24h > 0) {
    const increase = issue.counts.occurrences_24h - previousOccurrences24h;
    const percentIncrease = (increase / previousOccurrences24h) * 100;
    trendVelocity = Math.min(Math.max(percentIncrease, 0), CAPS.trend_velocity);
  }

  // Total priority score
  const totalScore =
    baseScore + occurrencesNormalized + usersNormalized + trendVelocity;

  return {
    severity_component: baseScore,
    environment_component: envWeight,
    occurrences_component: occurrencesNormalized,
    users_component: usersNormalized,
    trend_component: trendVelocity,
    total_score: totalScore,
  };
}

/**
 * Compare two issues by priority (for sorting)
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareByPriority(a: Issue, b: Issue): number {
  const scoreA = calculatePriorityScore(a).total_score;
  const scoreB = calculatePriorityScore(b).total_score;

  // Higher priority first (descending)
  return scoreB - scoreA;
}

/**
 * Rank issues by priority
 * Returns issues sorted by priority score (highest first)
 */
export function rankByPriority(issues: Issue[]): Issue[] {
  return [...issues].sort(compareByPriority);
}

/**
 * Get priority tier label based on score
 */
export function getPriorityTier(score: number): 'critical' | 'high' | 'medium' | 'low' {
  if (score >= 150) return 'critical'; // P0 in prod with high occurrence
  if (score >= 100) return 'high'; // P1 in prod or P0 in stage
  if (score >= 50) return 'medium'; // P2 in prod or P1 in stage
  return 'low';
}

/**
 * Check if issue meets threshold for AI triage
 * Based on Section 4.5: eligible_severity_min and eligible_recurrence_min
 */
export function meetsAITriageThreshold(
  issue: Issue,
  minSeverity: Severity = 'P1',
  minRecurrence: number = 5
): boolean {
  // Check severity threshold
  const severityOrder: Severity[] = ['P0', 'P1', 'P2', 'P3'];
  const issueSeverityIndex = severityOrder.indexOf(issue.severity as Severity);
  const minSeverityIndex = severityOrder.indexOf(minSeverity);

  if (issueSeverityIndex > minSeverityIndex) {
    return false;
  }

  // Check recurrence threshold
  if (issue.counts.occurrences_24h < minRecurrence) {
    return false;
  }

  return true;
}

/**
 * Calculate trend direction based on occurrence history
 */
export function calculateTrendDirection(
  current24h: number,
  previous24h: number
): 'increasing' | 'stable' | 'decreasing' {
  if (previous24h === 0) {
    return current24h > 0 ? 'increasing' : 'stable';
  }

  const changePercent = ((current24h - previous24h) / previous24h) * 100;

  if (changePercent > 10) return 'increasing';
  if (changePercent < -10) return 'decreasing';
  return 'stable';
}
