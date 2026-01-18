/**
 * BritePulse Enumeration Types
 * Based on Build Contract v0.1
 */

// Issue severity levels (P0 = critical, P3 = low)
export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

// Issue status state machine (Section 6)
export type IssueStatus =
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'blocked'
  | 'snoozed'
  | 'resolved';

// Event types captured by the system
export type EventType = 'feedback' | 'frontend_error' | 'backend_error';

// Issue classification types
export type IssueType = 'bug' | 'feature' | 'feedback' | 'question';

// User roles for RBAC (Section 2)
export type UserRole = 'Admin' | 'PO' | 'Engineer' | 'ReadOnly';

// Redaction profile levels (Section 4.5)
export type RedactionProfile = 'strict' | 'standard' | 'relaxed';

// AI triage next action recommendations (Section 4.9)
export type NextAction =
  | 'investigate'
  | 'request_info'
  | 'route_engineering'
  | 'create_ticket'
  | 'monitor_only';

// Audit log target types (Section 4.10)
export type AuditTargetType = 'app' | 'issue' | 'event' | 'attachment' | 'user';

// Environment names
export type Environment = 'prod' | 'stage' | 'dev' | string;

// Allowed issue status transitions (Section 6)
export const ALLOWED_STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  new: ['triaged', 'in_progress'],
  triaged: ['in_progress', 'blocked', 'snoozed'],
  in_progress: ['blocked', 'resolved'],
  blocked: ['in_progress'],
  snoozed: ['triaged', 'resolved'],
  resolved: ['triaged'], // reopen only with new evidence
};

// Severity weights for priority scoring (Section 8.1)
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  P0: 100,
  P1: 60,
  P2: 30,
  P3: 10,
};

// Environment weights for priority scoring (Section 8.2)
export const ENVIRONMENT_WEIGHTS: Record<string, number> = {
  prod: 1.0,
  stage: 0.6,
  dev: 0.3,
};
