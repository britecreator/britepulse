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
import { generateContextFile, generateContextJSON } from '../services/context-generator.js';
import { sendResolvedNotification, sendWontFixNotification } from '../services/email.js';
import { config } from '../config.js';

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

    // Send email notification when issue is resolved and we have reporter email
    if (status === 'resolved' && updatedIssue?.reported_by?.email) {
      const app = await firestoreService.getApp(issue.app_id);
      if (app) {
        // Send async - don't block the response
        sendResolvedNotification(updatedIssue, app).catch((err) => {
          console.error('[Issues] Failed to send resolved notification:', err);
        });
      }
    }

    // Send email notification when issue is marked as won't fix and we have reporter email
    if (status === 'wont_fix' && updatedIssue?.reported_by?.email) {
      const app = await firestoreService.getApp(issue.app_id);
      if (app) {
        // Send async - don't block the response
        sendWontFixNotification(updatedIssue, app).catch((err) => {
          console.error('[Issues] Failed to send wont fix notification:', err);
        });
      }
    }

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

/**
 * GET /issues/:issue_id/context
 * Generate AI context file for external AI agent consumption
 * Returns markdown (default) or JSON format
 */
router.get(
  '/:issue_id/context',
  requirePermission('view_issue_detail'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const format = (req.query.format as string) || 'markdown';

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // Get events and app
    const events = await firestoreService.getEventsByIssue(issue_id, 20);
    const app = await firestoreService.getApp(issue.app_id);

    if (!app) {
      throw APIError.notFound('App');
    }

    const contextData = { issue, events, app };

    // Log context download
    await logAuditAction(req, 'download_context', 'issue', issue_id, {
      format,
    });

    if (format === 'json') {
      res.json({ data: generateContextJSON(contextData) });
    } else {
      const markdown = generateContextFile(contextData);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="issue-${issue_id}-context.md"`
      );
      res.send(markdown);
    }
  })
);

/**
 * POST /issues/:issue_id/actions/merge
 * Merge source issues into this target issue
 */
router.post(
  '/:issue_id/actions/merge',
  requirePermission('change_status'),
  asyncHandler(async (req, res) => {
    const { issue_id: targetIssueId } = req.params;
    const { source_issue_ids, reason } = req.body;

    if (!source_issue_ids || !Array.isArray(source_issue_ids) || source_issue_ids.length === 0) {
      throw APIError.badRequest('source_issue_ids must be a non-empty array');
    }

    if (!reason) {
      throw APIError.badRequest('reason is required');
    }

    // Verify target issue exists
    const targetIssue = await firestoreService.getIssue(targetIssueId);
    if (!targetIssue) {
      throw APIError.notFound('Target issue');
    }

    // Check app access for target
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(targetIssue.app_id)) {
      throw APIError.forbidden('Access to target issue is denied');
    }

    // Verify all source issues exist and user has access
    for (const sourceId of source_issue_ids) {
      const sourceIssue = await firestoreService.getIssue(sourceId);
      if (!sourceIssue) {
        throw APIError.notFound(`Source issue ${sourceId}`);
      }
      if (accessibleAppIds && !accessibleAppIds.includes(sourceIssue.app_id)) {
        throw APIError.forbidden(`Access to source issue ${sourceId} is denied`);
      }
      if (sourceIssue.app_id !== targetIssue.app_id) {
        throw APIError.badRequest('All issues must belong to the same app');
      }
    }

    const updatedIssue = await firestoreService.mergeIssues(targetIssueId, source_issue_ids);

    await logAuditAction(req, 'merge_issues', 'issue', targetIssueId, {
      source_issue_ids,
      reason,
    });

    res.json({ data: updatedIssue });
  })
);

/**
 * POST /issues/:issue_id/actions/triage
 * Manually trigger AI triage analysis
 */
router.post(
  '/:issue_id/actions/triage',
  requirePermission('change_status'),
  asyncHandler(async (req, res) => {
    const { issue_id } = req.params;
    const { force = false } = req.body;

    const issue = await firestoreService.getIssue(issue_id);
    if (!issue) {
      throw APIError.notFound('Issue');
    }

    // Check app access
    const accessibleAppIds = getAccessibleAppIds(req);
    if (accessibleAppIds && !accessibleAppIds.includes(issue.app_id)) {
      throw APIError.forbidden('Access to this issue is denied');
    }

    // Check if AI triage is configured
    if (!config.anthropicApiKey) {
      throw APIError.badRequest('AI triage is not configured on this server');
    }

    // Lazy load AI triage module
    const aiTriage = await import('@britepulse/ai-triage');
    aiTriage.initClient(config.anthropicApiKey);

    // Get events and app
    const events = await firestoreService.getEventsByIssue(issue_id, 20);
    const app = await firestoreService.getApp(issue.app_id);

    // Run triage
    const result = await aiTriage.runTriage(issue, events, app?.name || 'Unknown', {
      force,
    });

    if (result.success && result.analysis) {
      // Store analysis on issue
      await firestoreService.updateIssue(issue_id, {
        ai_analysis: result.analysis,
      });

      await logAuditAction(req, 'run_triage', 'issue', issue_id, {
        analysis_id: result.analysis.analysis_id,
        confidence: result.analysis.confidence,
      });
    }

    res.json({ data: result });
  })
);

export default router;
