/**
 * Admin routes
 * App management, keys, policies, schedules
 */

import { Router, type IRouter } from 'express';
import { schemas } from '@britepulse/shared';
import { asyncHandler, APIError, oauthAuth, requireAdmin, autoAudit, logAuditAction } from '../middleware/index.js';
import * as firestoreService from '../services/firestore.js';

const router: IRouter = Router();

// All admin routes require OAuth authentication
router.use(oauthAuth(true));

/**
 * GET /admin/apps
 * List all apps (Admin sees all, others see their accessible apps)
 */
router.get(
  '/apps',
  autoAudit('view_app_list', 'app'),
  asyncHandler(async (req, res) => {
    const user = req.auth!.user!;

    // Admin sees all apps, others see only their accessible apps
    const appIds = user.role === 'Admin' ? undefined : user.app_access;
    const apps = await firestoreService.getApps(appIds);

    res.json({
      data: apps,
      meta: {
        total: apps.length,
      },
    });
  })
);

/**
 * POST /admin/apps
 * Create a new app (Admin only)
 */
router.post(
  '/apps',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parseResult = schemas.CreateAppInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const app = await firestoreService.createApp(parseResult.data);

    // Create install keys for each environment
    for (const env of app.environments) {
      await firestoreService.createInstallKeys(app.app_id, env.env_name);
    }

    await logAuditAction(req, 'create_app', 'app', app.app_id, {
      app_name: app.name,
    });

    res.status(201).json({ data: app });
  })
);

/**
 * GET /admin/apps/:app_id
 * Get a single app by ID
 */
router.get(
  '/apps/:app_id',
  autoAudit('view_app', 'app'),
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;
    const user = req.auth!.user!;

    const app = await firestoreService.getApp(app_id);
    if (!app) {
      throw APIError.notFound('App');
    }

    // Check access (Admin can see all, others need explicit access)
    if (user.role !== 'Admin' && !user.app_access.includes(app_id)) {
      throw APIError.forbidden('Access to this app is denied');
    }

    // Fetch install keys for each environment
    // Only Admins can see server keys
    const isAdmin = user.role === 'Admin';
    const install_keys: Record<string, { public_key: string; server_key?: string; key_rotated_at: string }> = {};
    for (const env of app.environments) {
      const keys = await firestoreService.getInstallKeys(app_id, env.env_name);
      if (keys) {
        install_keys[env.env_name] = isAdmin
          ? keys
          : { public_key: keys.public_key, key_rotated_at: keys.key_rotated_at };
      }
    }

    res.json({ data: { ...app, install_keys } });
  })
);

/**
 * PATCH /admin/apps/:app_id
 * Update app settings (Admin only)
 */
router.patch(
  '/apps/:app_id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;

    const parseResult = schemas.UpdateAppInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const app = await firestoreService.updateApp(app_id, parseResult.data);
    if (!app) {
      throw APIError.notFound('App');
    }

    await logAuditAction(req, 'update_app', 'app', app_id, {
      changed_fields: Object.keys(parseResult.data),
    });

    res.json({ data: app });
  })
);

/**
 * POST /admin/apps/:app_id/rotate-keys
 * Rotate install keys for an app (Admin only)
 */
router.post(
  '/apps/:app_id/rotate-keys',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;
    const { environment, key_type = 'both' } = req.body;

    if (!environment) {
      throw APIError.badRequest('environment is required');
    }

    if (!['public', 'server', 'both'].includes(key_type)) {
      throw APIError.badRequest('key_type must be public, server, or both');
    }

    const app = await firestoreService.getApp(app_id);
    if (!app) {
      throw APIError.notFound('App');
    }

    const envExists = app.environments.some((e) => e.env_name === environment);
    if (!envExists) {
      throw APIError.badRequest(`Environment ${environment} does not exist for this app`);
    }

    const keys = await firestoreService.rotateInstallKeys(app_id, environment, key_type);

    await logAuditAction(req, 'rotate_keys', 'app', app_id, {
      environment,
      key_type,
    });

    res.json({ data: keys });
  })
);

/**
 * PATCH /admin/apps/:app_id/owners
 * Update app owners (Admin only)
 */
router.patch(
  '/apps/:app_id/owners',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;

    const parseResult = schemas.UpdateOwnersInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const app = await firestoreService.updateApp(app_id, { owners: parseResult.data });
    if (!app) {
      throw APIError.notFound('App');
    }

    await logAuditAction(req, 'update_owners', 'app', app_id, {
      new_owners: parseResult.data,
    });

    res.json({ data: app });
  })
);

/**
 * PATCH /admin/apps/:app_id/policies
 * Update app policies (Admin only)
 */
router.patch(
  '/apps/:app_id/policies',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;

    const parseResult = schemas.UpdatePoliciesInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const existingApp = await firestoreService.getApp(app_id);
    if (!existingApp) {
      throw APIError.notFound('App');
    }

    // Merge with existing policies
    const mergedPolicies = {
      ...existingApp.policies,
      ...parseResult.data,
    } as typeof existingApp.policies;

    const app = await firestoreService.updateApp(app_id, { policies: mergedPolicies });

    await logAuditAction(req, 'update_policies', 'app', app_id, {
      changed_fields: Object.keys(parseResult.data),
    });

    res.json({ data: app });
  })
);

/**
 * PATCH /admin/apps/:app_id/schedules
 * Update app schedules (Admin only)
 */
router.patch(
  '/apps/:app_id/schedules',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;

    const parseResult = schemas.UpdateSchedulesInputSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const existingApp = await firestoreService.getApp(app_id);
    if (!existingApp) {
      throw APIError.notFound('App');
    }

    // Merge with existing schedules
    const mergedSchedules = {
      ...existingApp.schedules,
      ...parseResult.data,
    } as typeof existingApp.schedules;

    const app = await firestoreService.updateApp(app_id, { schedules: mergedSchedules });

    await logAuditAction(req, 'update_schedules', 'app', app_id, {
      changed_fields: Object.keys(parseResult.data),
    });

    res.json({ data: app });
  })
);

/**
 * GET /admin/apps/:app_id/health
 * Get installation health metrics for an app (Admin only)
 */
router.get(
  '/apps/:app_id/health',
  requireAdmin,
  autoAudit('view_app_health', 'app'),
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;
    const environment = (req.query.environment as string) || 'prod';

    const app = await firestoreService.getApp(app_id);
    if (!app) {
      throw APIError.notFound('App');
    }

    // TODO: Implement actual health metrics from events
    const health = {
      app_id,
      environment,
      status: 'healthy' as const,
      metrics: {
        last_event_received: new Date().toISOString(),
        events_24h: 0,
        missing_version_rate: 0,
        missing_trace_rate: 0,
      },
      issues: {
        total_open: 0,
        p0_open: 0,
        p1_open: 0,
      },
    };

    res.json({ data: health });
  })
);

export default router;
