/**
 * User Entity Types
 * Based on Build Contract Section 2 (RBAC)
 */

import type { UserRole } from './enums.js';

/**
 * User entity
 */
export interface User {
  user_id: string;
  email: string;
  name?: string;
  role: UserRole;
  app_access: string[]; // list of app_ids user can access
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

/**
 * User session (authenticated context)
 */
export interface UserSession {
  user_id: string;
  email: string;
  name?: string;
  role: UserRole;
  app_access: string[];
  session_id: string;
  expires_at: string;
}

/**
 * User creation/update input
 */
export interface UserInput {
  email: string;
  name?: string;
  role: UserRole;
  app_access: string[];
}

/**
 * RBAC permission check context
 */
export interface PermissionContext {
  user: UserSession;
  action: string;
  resource_type: 'app' | 'issue' | 'event' | 'attachment' | 'user';
  resource_id?: string;
  app_id?: string; // for scoped resources
}

/**
 * RBAC Matrix (Section 2)
 * Defines what each role can do
 */
export const RBAC_MATRIX = {
  // View issue list - all roles, scoped by app access
  view_issue_list: ['Admin', 'PO', 'Engineer', 'ReadOnly'] as UserRole[],

  // View issue detail - all roles, scoped by app access
  view_issue_detail: ['Admin', 'PO', 'Engineer', 'ReadOnly'] as UserRole[],

  // Change issue status - Admin, PO, Engineer (scoped by policy)
  change_status: ['Admin', 'PO', 'Engineer'] as UserRole[],

  // Change severity - Admin, PO only
  change_severity: ['Admin', 'PO'] as UserRole[],

  // Manage apps/keys/policies - Admin only
  manage_apps: ['Admin'] as UserRole[],
  manage_keys: ['Admin'] as UserRole[],
  manage_policies: ['Admin'] as UserRole[],

  // View attachments - Admin, PO by default; Engineer if assigned
  view_attachments: ['Admin', 'PO'] as UserRole[],

  // Manage users - Admin only
  manage_users: ['Admin'] as UserRole[],

  // View audit logs - Admin only
  view_audit_logs: ['Admin'] as UserRole[],

  // Trigger AI triage - Admin, PO
  trigger_ai_triage: ['Admin', 'PO'] as UserRole[],

  // Daily brief preview - Admin, PO
  preview_daily_brief: ['Admin', 'PO'] as UserRole[],
} as const;

/**
 * Check if a role has permission for an action
 */
export function hasPermission(
  role: UserRole,
  action: keyof typeof RBAC_MATRIX
): boolean {
  const allowedRoles = RBAC_MATRIX[action];
  return allowedRoles.includes(role);
}

/**
 * Check if user has access to a specific app
 */
export function hasAppAccess(user: UserSession, appId: string): boolean {
  // Admin can access all apps
  if (user.role === 'Admin') {
    return true;
  }
  return user.app_access.includes(appId);
}
