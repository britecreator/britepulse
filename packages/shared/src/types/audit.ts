/**
 * Audit Log Entity Types
 * Based on Build Contract Section 4.10
 */

import type { AuditTargetType, UserRole } from './enums.js';

/**
 * Audit log entry (Section 4.10)
 * Records all console actions
 */
export interface AuditLog {
  // Required fields
  audit_id: string;
  actor_id: string; // user email or system identifier
  actor_role: UserRole | 'system';
  action: string; // e.g., 'view_issue', 'change_status', 'rotate_keys'
  target_type: AuditTargetType;
  target_id: string;
  timestamp: string; // ISO timestamp

  // Additional context (sanitized)
  metadata: AuditMetadata;
}

/**
 * Audit metadata - varies by action type
 */
export interface AuditMetadata {
  // For status/severity changes
  previous_value?: string;
  new_value?: string;
  reason?: string;

  // For assignments
  assigned_from?: string;
  assigned_to?: string;

  // For app config changes
  changed_fields?: string[];

  // For key rotations
  key_type?: 'public' | 'server';
  environment?: string;

  // General context
  ip_address?: string;
  user_agent?: string;
  request_id?: string;

  // Custom fields (must be sanitized)
  [key: string]: unknown;
}

/**
 * Audit action types
 */
export type AuditAction =
  // Issue actions
  | 'view_issue'
  | 'view_issue_list'
  | 'change_status'
  | 'change_severity'
  | 'assign_issue'
  | 'request_info'
  | 'create_ticket'
  | 'resolve_issue'
  // App management
  | 'create_app'
  | 'update_app'
  | 'delete_app'
  | 'update_owners'
  | 'update_policies'
  | 'update_schedules'
  | 'rotate_keys'
  // Attachment access
  | 'view_attachment'
  | 'download_attachment'
  // User management
  | 'update_user_role'
  | 'update_user_access'
  // AI triage
  | 'trigger_ai_triage'
  | 'view_ai_analysis'
  // Daily brief
  | 'preview_daily_brief'
  | 'send_daily_brief';

/**
 * Audit log creation input
 */
export interface AuditLogInput {
  actor_id: string;
  actor_role: UserRole | 'system';
  action: AuditAction | string;
  target_type: AuditTargetType;
  target_id: string;
  metadata?: Partial<AuditMetadata>;
}

/**
 * Audit log filter options
 */
export interface AuditLogFilters {
  actor_id?: string;
  actor_role?: UserRole | 'system';
  action?: AuditAction | string;
  target_type?: AuditTargetType;
  target_id?: string;
  after?: string; // ISO timestamp
  before?: string; // ISO timestamp
}

/**
 * Audit log list response
 */
export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}
