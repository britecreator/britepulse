/**
 * Daily Brief Types
 * Based on Build Contract Section 8 and Product Spec Section 6E
 */

import type { Issue } from './issue.js';
import type { Severity } from './enums.js';

/**
 * Daily brief issue summary (for email)
 */
export interface BriefIssueSummary {
  issue_id: string;
  title: string;
  severity: Severity;
  issue_type: string;
  impact_summary: string;
  occurrences_24h: number;
  unique_users_24h_est: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  ai_summary?: string;
  recommended_action: string;
  console_url: string;
}

/**
 * Daily brief content
 */
export interface DailyBrief {
  brief_id: string;
  app_id: string;
  app_name: string;
  environment: string;
  generated_at: string; // ISO timestamp
  period_start: string; // ISO timestamp (24h ago)
  period_end: string; // ISO timestamp (now)

  // Summary stats
  total_issues_in_period: number;
  new_issues_count: number;
  resolved_issues_count: number;
  p0_count: number;
  p1_count: number;

  // Top issues
  issues: BriefIssueSummary[];

  // Links
  dashboard_url: string;
}

/**
 * Daily brief email payload
 */
export interface DailyBriefEmail {
  to: string[];
  subject: string;
  html: string;
  text: string;
  brief: DailyBrief;
}

/**
 * Daily brief send result
 */
export interface DailyBriefSendResult {
  success: boolean;
  brief_id: string;
  app_id: string;
  recipients: string[];
  sent_at?: string;
  error?: string;
}

/**
 * Daily brief run request (internal/admin)
 */
export interface DailyBriefRunRequest {
  app_id?: string; // if not specified, run for all apps
  environment?: string; // if not specified, run for all environments
  force?: boolean; // run even if already sent today
}

/**
 * Daily brief preview request
 */
export interface DailyBriefPreviewRequest {
  app_id: string;
  environment: string;
}

/**
 * Priority calculation for daily brief selection
 */
export interface IssuePriorityScore {
  issue: Issue;
  priority_score: number;
  severity_component: number;
  environment_component: number;
  occurrences_component: number;
  users_component: number;
  trend_component: number;
}

/**
 * Daily brief selection rules (Section 8.5)
 */
export const DAILY_BRIEF_RULES = {
  // Min/max items (configurable per app)
  default_min_items: 5,
  default_max_items: 10,

  // Must include
  must_include: {
    // Any P0 new or unresolved
    all_p0_unresolved: true,
    // Top recurring issue in last 24h if not resolved
    top_recurring_unresolved: true,
  },

  // Diversity rule: no more than N items from same fingerprint cluster
  max_items_per_fingerprint: 3,
  // Exception: if all items are P0/P1, ignore diversity rule
  diversity_exception_severities: ['P0', 'P1'] as Severity[],
};
