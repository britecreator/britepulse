/**
 * Issue routes
 * Issue listing, details, and actions
 */

import { Router, type IRouter } from 'express';
import { schemas, ALLOWED_STATUS_TRANSITIONS, type IssueStatus } from '@britepulse/shared';
import {
  asyncHandler,
  APIError,
  oauthAuth,
  requirePermission,
  canChangeIssueStatus,
  canChangeSeverity,
  getAccessibleAppIds,
  autoAudit,
  logAuditAction,
} from '../middleware/index.js';
import * as firestoreService from '../services/firestore.js';

const router: IRouter = Router();

// All issue routes require OAuth authentication
router.use(oauthAuth(true));

/**
 * GET /issues
 * List issues with filtering and sorting
 */
router.get(
  '/',
  requirePermission('view_issue_list'),
  autoAudit('view_issue_list', 'issue'),
  asyncHandler(async (req, res) => {
    const parseResult = schemas.IssueListQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid query parameters', {
        issues: parseResult.error.issues,
      });
    }

    const { page, page_size, sort_by, sort_dir, ...filters } = parseResult.data;

    // Get accessible app IDs based on user's role and access
    const accessibleAppIds = getAccessibleAppIds(req);

    const { issues, total } = await firestoreService.getIssues(
      filters,
      { field: sort_by, direction: sort_dir },
      page,
      page_size,
      accessibleAppIds
    );

    res.json({
      data: issues,
      pagination: {
        total,
        page,
        page_size,
        has_more: page * page_size < total,
      },
    });
  })
);

/**
 * GET /issues/:issue_id
 * Get a single issue by ID
 */
router.get(
  '/:issue_id',
  requirePermission('view_issue_detail'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // Log view action
    await logAuditAction(req, 'view_issue', 'issue', issue_id, {
      app_id: issue.app_id,
    });

    res.json({ data: issue });
  })
);

/**
 * POST /issues/:issue_id/actions/set-status
 * Change issue status
 */
router.post(
  '/:issue_id/actions/set-status',
  canChangeIssueStatus,
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { status, reason } = req.body;

    if (!status || !reason) {
      throw APIError.badRequest('status and reason are required');
    }

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // Validate status transition
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[issue.status as IssueStatus];
    if (!allowedTransitions.includes(status as IssueStatus)) {
      throw APIError.badRequest(
        `Cannot transition from ${issue.status} to ${status}. Allowed: ${allowedTransitions.join(', ')}`
      );
    }

    // Special case: reopen requires Admin/PO and must have reason
    if (issue.status === 'resolved' && status === 'triaged') {
      const user = req.auth!.user!;
      if (user.role !== 'Admin' && user.role !== 'PO') {
        throw APIError.forbidden('Only Admin or PO can reopen resolved issues');
      }
    }

    const updatedIssue = await firestoreService.updateIssue(issue_id, {
      status: status as IssueStatus,
      reason,
    });

    await logAuditAction(req, 'change_status', 'issue', issue_id, {
      previous_value: issue.status,
      new_value: status,
      reason,
    });

    res.json({ data: updatedIssue });
  })
);

/**
 * POST /issues/:issue_id/actions/set-severity
 * Change issue severity
 */
router.post(
  '/:issue_id/actions/set-severity',
  canChangeSeverity,
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { severity, reason } = req.body;

    if (!severity || !reason) {
      throw APIError.badRequest('severity and reason are required');
    }

    if (!['P0', 'P1', 'P2', 'P3'].includes(severity)) {
      throw APIError.badRequest('severity must be P0, P1, P2, or P3');
    }

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    const updatedIssue = await firestoreService.updateIssue(issue_id, {
      severity,
      reason,
    });

    await logAuditAction(req, 'change_severity', 'issue', issue_id, {
      previous_value: issue.severity,
      new_value: severity,
      reason,
    });

    res.json({ data: updatedIssue });
  })
);

/**
 * POST /issues/:issue_id/actions/assign
 * Assign issue to a user/team
 */
router.post(
  '/:issue_id/actions/assign',
  requirePermission('change_status'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { assigned_to, reason } = req.body;

    if (!assigned_to || !reason) {
      throw APIError.badRequest('assigned_to and reason are required');
    }

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    const updatedIssue = await firestoreService.updateIssue(issue_id, {
      assigned_to,
      reason,
    });

    await logAuditAction(req, 'assign_issue', 'issue', issue_id, {
      assigned_from: issue.routing?.assigned_to,
      assigned_to,
      reason,
    });

    res.json({ data: updatedIssue });
  })
);

/**
 * POST /issues/:issue_id/actions/request-info
 * Request more information about an issue
 */
router.post(
  '/:issue_id/actions/request-info',
  requirePermission('change_status'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { message, reason } = req.body;

    if (!message || !reason) {
      throw APIError.badRequest('message and reason are required');
    }

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // TODO: Send notification to reporter if contactable

    await logAuditAction(req, 'request_info', 'issue', issue_id, {
      message,
      reason,
    });

    res.json({
      data: {
        success: true,
        message: 'Information request recorded',
      },
    });
  })
);

/**
 * POST /issues/:issue_id/actions/create-ticket
 * Create a ticket in external system (stub in v1)
 */
router.post(
  '/:issue_id/actions/create-ticket',
  requirePermission('change_status'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw APIError.badRequest('reason is required');
    }

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // TODO: Integrate with ticketing system
    // For v1, just record the action

    await logAuditAction(req, 'create_ticket', 'issue', issue_id, {
      reason,
    });

    res.json({
      data: {
        success: true,
        message: 'Ticket creation recorded (integration pending)',
        ticket_url: null,
      },
    });
  })
);

/**
 * POST /issues/:issue_id/actions/resolve
 * Resolve an issue
 */
router.post(
  '/:issue_id/actions/resolve',
  canChangeIssueStatus,
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw APIError.badRequest('reason is required');
    }

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // Check if can transition to resolved
    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[issue.status as IssueStatus];
    if (!allowedTransitions.includes('resolved')) {
      throw APIError.badRequest(
        `Cannot resolve from ${issue.status}. Must be in: in_progress or snoozed`
      );
    }

    const updatedIssue = await firestoreService.updateIssue(issue_id, {
      status: 'resolved',
      reason,
    });

    await logAuditAction(req, 'resolve_issue', 'issue', issue_id, {
      previous_status: issue.status,
      reason,
    });

    res.json({ data: updatedIssue });
  })
);

/**
 * GET /issues/:issue_id/events
 * Get events associated with an issue
 */
router.get(
  '/:issue_id/events',
  requirePermission('view_issue_detail'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    const events = await firestoreService.getEventsByIssue(issue_id, limit);

    res.json({
      data: events,
      meta: {
        total: issue.event_refs.length,
        returned: events.length,
      },
    });
  })
);

export default router;
