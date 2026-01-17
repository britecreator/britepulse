/**
 * Audit logging middleware
 * Records all console actions per Build Contract Section 4.10
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { AuditLogInput, AuditTargetType, UserRole } from '@britepulse/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        targetType?: AuditTargetType;
        targetId?: string;
        action?: string;
        metadata?: Record<string, unknown>;
      };
    }
  }
}

// In-memory store for now (will be replaced with Firestore)
const auditLogs: AuditLogInput[] = [];

/**
 * Get all audit logs (for development/testing)
 */
export function getAuditLogs(): AuditLogInput[] {
  return [...auditLogs];
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  const entry = {
    ...input,
    audit_id: uuidv4(),
    timestamp: new Date().toISOString(),
  };

  // TODO: Store in Firestore
  auditLogs.push(entry);

  console.log('[Audit]', JSON.stringify(entry));
}

/**
 * Set audit context on request (for use by route handlers)
 */
export function setAuditContext(
  req: Request,
  context: {
    targetType: AuditTargetType;
    targetId: string;
    action?: string;
    metadata?: Record<string, unknown>;
  }
): void {
  req.auditContext = {
    ...req.auditContext,
    ...context,
  };
}

/**
 * Auto-audit middleware for specific routes
 * Automatically logs the action based on the route
 */
export function autoAudit(action: string, targetType: AuditTargetType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Set the action context
    req.auditContext = {
      ...req.auditContext,
      action,
      targetType,
    };

    // Hook into response finish to log the action
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: Parameters<typeof res.end>) {
      // Only log successful requests
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const targetId =
          req.auditContext?.targetId ||
          req.params.issue_id ||
          req.params.app_id ||
          req.params.id ||
          'unknown';

        createAuditLog({
          actor_id: req.auth?.user?.email || req.auth?.appId || 'anonymous',
          actor_role: (req.auth?.user?.role || 'system') as UserRole | 'system',
          action: req.auditContext?.action || action,
          target_type: req.auditContext?.targetType || targetType,
          target_id: targetId,
          metadata: {
            ...req.auditContext?.metadata,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            request_id: req.requestId,
          },
        });
      }

      return originalEnd.apply(this, args);
    } as typeof res.end;

    next();
  };
}

/**
 * Manual audit helper for route handlers
 */
export async function logAuditAction(
  req: Request,
  action: string,
  targetType: AuditTargetType,
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await createAuditLog({
    actor_id: req.auth?.user?.email || req.auth?.appId || 'anonymous',
    actor_role: (req.auth?.user?.role || 'system') as UserRole | 'system',
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: {
      ...metadata,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      request_id: req.requestId,
    },
  });
}

/**
 * Audit log query helper
 */
export interface AuditLogQuery {
  actor_id?: string;
  target_type?: AuditTargetType;
  target_id?: string;
  action?: string;
  after?: string;
  before?: string;
  limit?: number;
  offset?: number;
}

export async function queryAuditLogs(query: AuditLogQuery): Promise<{
  logs: AuditLogInput[];
  total: number;
}> {
  // TODO: Implement Firestore query
  let filtered = [...auditLogs];

  if (query.actor_id) {
    filtered = filtered.filter((log) => log.actor_id === query.actor_id);
  }
  if (query.target_type) {
    filtered = filtered.filter((log) => log.target_type === query.target_type);
  }
  if (query.target_id) {
    filtered = filtered.filter((log) => log.target_id === query.target_id);
  }
  if (query.action) {
    filtered = filtered.filter((log) => log.action === query.action);
  }

  const total = filtered.length;
  const offset = query.offset || 0;
  const limit = query.limit || 50;

  return {
    logs: filtered.slice(offset, offset + limit),
    total,
  };
}
