/**
 * Role-Based Access Control (RBAC) middleware
 * Based on Build Contract Section 2
 */

import type { Request, Response, NextFunction } from 'express';
import { hasPermission, hasAppAccess, RBAC_MATRIX, type UserRole } from '@britepulse/shared';
import { APIError } from './error-handler.js';

type PermissionKey = keyof typeof RBAC_MATRIX;

/**
 * Require specific role(s)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.user) {
      return next(APIError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.auth.user.role)) {
      return next(APIError.forbidden(`Requires one of: ${allowedRoles.join(', ')}`));
    }

    next();
  };
}

/**
 * Require specific permission (from RBAC matrix)
 */
export function requirePermission(permission: PermissionKey) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.user) {
      return next(APIError.unauthorized('Authentication required'));
    }

    if (!hasPermission(req.auth.user.role, permission)) {
      return next(APIError.forbidden(`Permission denied: ${permission}`));
    }

    next();
  };
}

/**
 * Require access to specific app
 * Extracts app_id from request params, query, or body
 */
export function requireAppAccess(paramName = 'app_id') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.user) {
      return next(APIError.unauthorized('Authentication required'));
    }

    // Get app_id from various sources
    const appId =
      req.params[paramName] ||
      req.query[paramName] as string ||
      (req.body && req.body[paramName]);

    if (!appId) {
      return next(APIError.badRequest(`${paramName} is required`));
    }

    if (!hasAppAccess(req.auth.user, appId)) {
      return next(APIError.forbidden('Access to this app is denied'));
    }

    next();
  };
}

/**
 * Require Admin role
 */
export const requireAdmin = requireRole('Admin');

/**
 * Require Admin or PO role
 */
export const requireAdminOrPO = requireRole('Admin', 'PO');

/**
 * Check if user can modify issue status
 * Based on Section 2: Admin/PO/Engineer can change status (scoped by policy)
 */
export function canChangeIssueStatus(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.user) {
    return next(APIError.unauthorized('Authentication required'));
  }

  const allowedRoles: UserRole[] = ['Admin', 'PO', 'Engineer'];
  if (!allowedRoles.includes(req.auth.user.role)) {
    return next(APIError.forbidden('Cannot change issue status with this role'));
  }

  next();
}

/**
 * Check if user can modify issue severity
 * Based on Section 2: Admin/PO only
 */
export function canChangeSeverity(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.user) {
    return next(APIError.unauthorized('Authentication required'));
  }

  const allowedRoles: UserRole[] = ['Admin', 'PO'];
  if (!allowedRoles.includes(req.auth.user.role)) {
    return next(APIError.forbidden('Cannot change severity with this role'));
  }

  next();
}

/**
 * Check if user can view attachments
 * Based on Section 2: Admin/PO by default; Engineer only if assigned; ReadOnly never
 */
export function canViewAttachment(options: { issueAssignedTo?: string } = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.user) {
      return next(APIError.unauthorized('Authentication required'));
    }

    const { role, email } = req.auth.user;

    // ReadOnly never sees attachments
    if (role === 'ReadOnly') {
      return next(APIError.forbidden('Attachments not available for your role'));
    }

    // Admin and PO can always view
    if (role === 'Admin' || role === 'PO') {
      return next();
    }

    // Engineer can view only if assigned
    if (role === 'Engineer') {
      if (options.issueAssignedTo && options.issueAssignedTo === email) {
        return next();
      }
      return next(APIError.forbidden('Attachments only available for assigned issues'));
    }

    return next(APIError.forbidden('Cannot view attachments'));
  };
}

/**
 * Filter issues by user's app access
 * Use in query building to ensure users only see issues from accessible apps
 */
export function getAccessibleAppIds(req: Request): string[] | null {
  if (!req.auth?.user) {
    return null;
  }

  // Admin can access all apps
  if (req.auth.user.role === 'Admin') {
    return null; // null means no restriction
  }

  return req.auth.user.app_access;
}

/**
 * Helper to check if current user is the one assigned to an issue
 */
export function isAssignedToIssue(req: Request, assignedTo?: string): boolean {
  if (!req.auth?.user || !assignedTo) {
    return false;
  }
  return req.auth.user.email === assignedTo;
}
