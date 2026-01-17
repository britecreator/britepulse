/**
 * Console-specific types
 * These are simplified versions for the UI
 */

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';
export type IssueStatus = 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix';
export type Environment = 'prod' | 'stage' | 'dev';
export type EventType = 'error' | 'feedback' | 'metric' | 'log';
export type UserRole = 'Admin' | 'PO' | 'Engineer' | 'ReadOnly';

export interface User {
  user_id: string;
  email: string;
  role: UserRole;
  app_access?: string[];
}

export interface App {
  app_id: string;
  name: string;
  environments: string[];
  base_url_patterns: string[];
  owners: string[];
  policies: {
    auto_triage: {
      enabled: boolean;
      min_severity: Severity;
      min_recurrence: number;
    };
    alert: {
      enabled: boolean;
      severity_threshold: Severity;
      channels: string[];
    };
    retention: {
      events_days: number;
      issues_days: number;
    };
  };
  schedules: {
    daily_brief: {
      enabled: boolean;
      time_utc: string;
      timezone: string;
      recipients: string[];
    };
    weekly_digest: {
      enabled: boolean;
      day: string;
      time_utc: string;
      timezone: string;
      recipients: string[];
    };
  };
  install_keys?: Record<string, {
    public_key: string;
    server_key: string;
  }>;
}

export interface IssueCounts {
  occurrences_24h: number;
  occurrences_total: number;
  unique_users_24h_est: number;
}

export interface IssueTimestamps {
  first_seen: string;
  last_seen: string;
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

export interface Issue {
  issue_id: string;
  app_id: string;
  environment: Environment;
  fingerprint: string;
  status: IssueStatus;
  severity: Severity;
  title: string;
  description: string;
  counts: IssueCounts;
  timestamps: IssueTimestamps;
  priority_score?: number;
  assigned_to?: string;
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
  payload: EventPayload;
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
