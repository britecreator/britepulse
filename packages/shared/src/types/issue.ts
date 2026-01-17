/**
 * Issue Entity Types
 * Based on Build Contract Section 4.8
 */

import type { Environment, IssueStatus, IssueType, Severity } from './enums.js';
import type { AIAnalysis } from './ai-analysis.js';

/**
 * Issue occurrence counts
 */
export interface IssueCounts {
  occurrences_total: number;
  occurrences_24h: number; // rolling 24-hour count
  unique_users_24h_est: number; // estimated unique users in 24h
}

/**
 * Issue timestamps
 */
export interface IssueTimestamps {
  created_at: string; // ISO timestamp
  last_seen_at: string; // ISO timestamp
}

/**
 * Issue routing/assignment information
 */
export interface IssueRouting {
  assigned_to?: string; // email or team identifier
}

/**
 * Issue entity (Section 4.8)
 * A deduped, grouped, triaged unit representing a bug or request
 */
export interface Issue {
  // Required fields
  issue_id: string;
  app_id: string;
  environment: Environment;
  status: IssueStatus;
  severity: Severity;
  title: string;
  description: string; // sanitized
  issue_type: IssueType;
  primary_fingerprint: string | null; // null for manual feedback
  event_refs: string[]; // list of event_ids
  counts: IssueCounts;
  timestamps: IssueTimestamps;

  // Optional fields
  routing?: IssueRouting;
  ai_analysis?: AIAnalysis;
  tags?: string[];
  related_issue_ids?: string[];

  // Computed for display (not stored)
  priority_score?: number;
}

/**
 * Issue creation input
 */
export interface IssueInput {
  app_id: string;
  environment: Environment;
  title: string;
  description: string;
  issue_type: IssueType;
  severity?: Severity; // default: P2
  primary_fingerprint?: string;
  initial_event_id: string;
  tags?: string[];
}

/**
 * Issue update input (for status/severity changes)
 */
export interface IssueUpdateInput {
  status?: IssueStatus;
  severity?: Severity;
  assigned_to?: string;
  tags?: string[];
  reason: string; // required for audit
}

/**
 * Issue action types for console operations
 */
export type IssueAction =
  | 'set-status'
  | 'set-severity'
  | 'assign'
  | 'request-info'
  | 'create-ticket'
  | 'resolve';

/**
 * Issue action payload
 */
export interface IssueActionPayload {
  action: IssueAction;
  reason: string; // required for audit
  new_status?: IssueStatus;
  new_severity?: Severity;
  assigned_to?: string;
  ticket_url?: string;
  request_info_message?: string;
}

/**
 * Issue filter options for listing
 */
export interface IssueFilters {
  app_id?: string;
  environment?: Environment;
  status?: IssueStatus | IssueStatus[];
  severity?: Severity | Severity[];
  issue_type?: IssueType | IssueType[];
  assigned_to?: string;
  tag?: string;
  version?: string;
  created_after?: string;
  created_before?: string;
  last_seen_after?: string;
  search?: string;
}

/**
 * Issue sort options
 */
export type IssueSortField =
  | 'priority_score'
  | 'severity'
  | 'occurrences_24h'
  | 'unique_users_24h_est'
  | 'last_seen_at'
  | 'created_at';

export interface IssueSortOptions {
  field: IssueSortField;
  direction: 'asc' | 'desc';
}

/**
 * Issue list response
 */
export interface IssueListResponse {
  issues: Issue[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
