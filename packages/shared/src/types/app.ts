/**
 * App Configuration Entity Types
 * Based on Build Contract Section 4.1-4.6
 */

import type { RedactionProfile, Severity, UserRole } from './enums.js';

/**
 * Environment configuration (Section 4.2)
 */
export interface EnvironmentConfig {
  env_name: string; // e.g., 'prod', 'stage', 'dev'
  enabled: boolean;
  daily_brief_enabled?: boolean; // default: true
  ai_enabled?: boolean; // default: true
}

/**
 * Repository mapping for code retrieval (Section 4.3)
 * Schema required for v1, implementation optional
 */
export interface RepoMapping {
  repo_id: string;
  services: string[];
  ownership_reviewers: string[]; // emails or identifiers
  path_scopes?: string[]; // repo paths allowed for retrieval
}

/**
 * Install keys per app per environment (Section 4.4)
 */
export interface InstallKeys {
  public_key: string; // used by client SDK, not secret but unguessable
  server_key: string; // secret, used for server/log ingestion
  key_rotated_at: string; // ISO timestamp
}

/**
 * Attachment policy configuration
 */
export interface AttachmentPolicy {
  allowed: boolean; // default: true
  restricted_roles: UserRole[]; // default: ['ReadOnly']
}

/**
 * AI triage policy configuration (Section 4.5)
 */
export interface AIPolicy {
  eligible_severity_min: Severity; // default: P1
  eligible_recurrence_min: number; // default: 5 occurrences/day
  model_allowed_inputs: string[]; // default: ['sanitized_feedback', 'sanitized_stack', 'retrieved_code_excerpts', 'metrics_summary']
}

/**
 * Telemetry collection policy
 */
export interface TelemetryPolicy {
  frontend_enabled: boolean; // default: true
  backend_enabled: boolean; // default: true
  sampling_rules: SamplingRule[];
}

export interface SamplingRule {
  route_pattern?: string;
  sample_rate: number; // 0.0 to 1.0
}

/**
 * Policy configuration (Section 4.5)
 */
export interface Policy {
  redaction_profile: RedactionProfile; // default: 'standard'
  attachment_policy: AttachmentPolicy;
  ai_policy: AIPolicy;
  telemetry_policy: TelemetryPolicy;
}

/**
 * Brief mode: when to send daily brief emails
 */
export type BriefMode = 'daily' | 'only_on_issues';

/**
 * Schedule configuration (Section 4.6)
 */
export interface Schedule {
  daily_brief_time_local: string; // HH:MM format
  daily_brief_timezone: string; // IANA timezone, default: 'America/Chicago'
  daily_brief_max_items: number; // default: 10
  daily_brief_min_items: number; // default: 5
  daily_brief_recipients: string[]; // default: owners.po_emails
  brief_mode?: BriefMode; // 'daily' = always send, 'only_on_issues' = skip if no active issues
}

/**
 * App owners configuration
 */
export interface AppOwners {
  po_emails: string[]; // required
  engineering_owner_group?: string | string[];
}

/**
 * App entity (Section 4.1)
 * Main configuration entity for registered applications
 */
export interface App {
  app_id: string; // stable identifier
  name: string;
  environments: EnvironmentConfig[];
  base_url_patterns: string[]; // URL patterns for this app
  owners: AppOwners;
  repo_mapping?: RepoMapping[];
  policies?: Policy;
  schedules?: Schedule;
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

/**
 * Default policy values
 */
export const DEFAULT_POLICY: Policy = {
  redaction_profile: 'standard',
  attachment_policy: {
    allowed: true,
    restricted_roles: ['ReadOnly'],
  },
  ai_policy: {
    eligible_severity_min: 'P1',
    eligible_recurrence_min: 5,
    model_allowed_inputs: [
      'sanitized_feedback',
      'sanitized_stack',
      'retrieved_code_excerpts',
      'metrics_summary',
    ],
  },
  telemetry_policy: {
    frontend_enabled: true,
    backend_enabled: true,
    sampling_rules: [],
  },
};

/**
 * Default schedule values
 */
export const DEFAULT_SCHEDULE: Omit<Schedule, 'daily_brief_recipients'> = {
  daily_brief_time_local: '08:00',
  daily_brief_timezone: 'America/Chicago',
  daily_brief_max_items: 10,
  daily_brief_min_items: 5,
};

/**
 * Default retention periods (Section 3.3)
 */
export const DEFAULT_RETENTION = {
  prod: {
    raw_events_days: 30,
    issues_days: 365,
    attachments_days: 14,
  },
  stage: {
    raw_events_days: 14,
    issues_days: 180,
    attachments_days: 7,
  },
  dev: {
    raw_events_days: 14,
    issues_days: 180,
    attachments_days: 7,
  },
};
