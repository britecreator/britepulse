/**
 * Console-specific types
 * These align with the shared package types
 */

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type IssueStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix';
export type Environment = 'prod' | 'stage' | 'dev';
export type EventType = 'error' | 'feedback' | 'metric' | 'log';
export type UserRole = 'Admin' | 'PO' | 'Engineer' | 'ReadOnly';

export interface User {
  user_id: string;
  email: string;
  name?: string;
  role: UserRole;
  app_access?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface EnvironmentConfig {
  env_name: string;
  enabled: boolean;
  daily_brief_enabled?: boolean;
  ai_enabled?: boolean;
}

export interface AppOwners {
  po_emails: string[];
  engineering_owner_group?: string | string[];
}

export interface AIPolicy {
  eligible_severity_min: Severity;
  eligible_recurrence_min: number;
  model_allowed_inputs: string[];
}

export interface AttachmentPolicy {
  allowed: boolean;
  restricted_roles: UserRole[];
}

export interface Policy {
  redaction_profile?: 'standard' | 'strict' | 'minimal';
  attachment_policy?: AttachmentPolicy;
  ai_policy?: AIPolicy;
  telemetry_policy?: {
    frontend_enabled: boolean;
    backend_enabled: boolean;
    sampling_rules: Array<{
      route_pattern?: string;
      sample_rate: number;
    }>;
  };
}

export interface Schedule {
  daily_brief_time_local?: string;
  daily_brief_timezone?: string;
  daily_brief_max_items?: number;
  daily_brief_min_items?: number;
  daily_brief_recipients?: string[];
  brief_mode?: 'daily' | 'only_on_issues';
}

export interface App {
  app_id: string;
  name: string;
  environments: EnvironmentConfig[];
  base_url_patterns: string[];
  owners: AppOwners;
  policies?: Policy;
  schedules?: Schedule;
  install_keys?: Record<string, {
    public_key: string;
    server_key: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface IssueCounts {
  occurrences_24h: number;
  occurrences_total: number;
  unique_users_24h_est: number;
}

export interface IssueTimestamps {
  created_at: string;
  last_seen_at: string;
  resolved_at?: string;
  wont_fix_at?: string;
}

export interface FixOption {
  option_number: number;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high';
  steps: string[];
}

export interface AIAnalysis {
  analysis_id: string;
  model_name: string;
  generated_at: string;
  classification: string;
  severity: Severity;
  severity_rationale: string;
  impact_summary: string;
  root_cause_hypothesis: string;
  fix_plan: FixOption[];
  confidence: number;
  assumptions: string[];
  limitations: string[];
  next_action: string;
  next_action_rationale: string;
  additional_info_needed?: string[];
}

export type IssueType = 'bug' | 'feature' | 'feedback' | 'question';

export interface IssueReporter {
  user_id: string;
  email?: string;
}

export interface IssueRouting {
  assigned_to?: string;
}

export interface Issue {
  issue_id: string;
  app_id: string;
  environment: Environment;
  fingerprint: string;
  status: IssueStatus;
  severity: Severity;
  title: string;
  description: string;
  issue_type: IssueType;
  counts: IssueCounts;
  timestamps: IssueTimestamps;
  priority_score?: number;
  routing?: IssueRouting;
  assigned_to?: string;
  resolution_note?: string;
  reported_by?: IssueReporter | null;
  ai_analysis?: AIAnalysis;
}

export interface EventPayload {
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
  feedback?: {
    comment: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
  };
}

export interface Event {
  event_id: string;
  app_id: string;
  environment: Environment;
  event_type: EventType;
  timestamp: string;
  route_or_url?: string;
  payload: EventPayload;
  attachment_refs?: string[];
}

export interface IssueFilters {
  app_id?: string;
  environment?: Environment | '';
  status?: IssueStatus[];
  severity?: Severity[];
  assigned_to?: string;
  search?: string;
  sort_by?: 'priority_score' | 'severity' | 'occurrences_24h' | 'unique_users_24h_est' | 'last_seen_at' | 'created_at';
  sort_dir?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}
