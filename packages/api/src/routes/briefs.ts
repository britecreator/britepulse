/**
 * Daily Brief routes
 * Scheduler trigger, preview, and test sending
 */

import { Router, type IRouter } from 'express';
import {
  asyncHandler,
  APIError,
  oauthAuth,
  requireRole,
  logAuditAction,
} from '../middleware/index.js';
import * as firestoreService from '../services/firestore.js';
import { config } from '../config.js';
import type { App, Issue } from '@britepulse/shared';

const router: IRouter = Router();

// Lazy load daily-brief module
let dailyBriefModule: typeof import('@britepulse/daily-brief') | null = null;

async function getDailyBrief() {
  if (!dailyBriefModule) {
    dailyBriefModule = await import('@britepulse/daily-brief');
  }
  return dailyBriefModule;
}

/**
 * Build SendGrid config from environment
 */
function getSendGridConfig() {
  return {
    apiKey: config.sendgridApiKey,
    fromEmail: config.sendgridFromEmail,
    fromName: 'BritePulse',
  };
}

/**
 * Get 24h stats for an app
 */
async function getAppStats(_appId: string, issues: Issue[]) {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // Count events in last 24h (sum from issues)
  const totalEvents24h = issues.reduce((sum, i) => sum + i.counts.occurrences_24h, 0);

  // Count new issues in last 24h
  const newIssues24h = issues.filter((i) => {
    const created = new Date(i.timestamps.created_at).getTime();
    return created > oneDayAgo;
  }).length;

  // Count resolved issues in last 24h
  const resolvedIssues24h = issues.filter((i) => {
    if (i.status !== 'resolved') return false;
    const timestamps = i.timestamps as { resolved_at?: string; last_seen_at: string };
    const resolved = new Date(timestamps.resolved_at || timestamps.last_seen_at).getTime();
    return resolved > oneDayAgo;
  }).length;

  return {
    totalEvents24h,
    newIssues24h,
    resolvedIssues24h,
  };
}

/**
 * POST /briefs/trigger
 * Trigger daily brief generation
 * Called by Cloud Scheduler or manually
 */
router.post(
  '/trigger',
  asyncHandler(async (req, res) => {
    // Authenticate via bearer token (for scheduler) or OAuth (for manual)
    const authHeader = req.headers.authorization;
    const schedulerToken = config.schedulerAuthToken;

    // Check for scheduler token auth
    const isSchedulerAuth = schedulerToken && authHeader === `Bearer ${schedulerToken}`;

    // If not scheduler auth, check OAuth
    if (!isSchedulerAuth) {
      // Try OAuth auth
      const oauthMiddleware = oauthAuth(true);
      const adminMiddleware = requireRole('Admin');

      // This is a bit hacky but we need to support both auth methods
      await new Promise<void>((resolve, reject) => {
        oauthMiddleware(req, res, (err) => {
          if (err) reject(err);
          else
            adminMiddleware(req, res, (err2) => {
              if (err2) reject(err2);
              else resolve();
            });
        });
      });
    }

    const { app_id, force = false } = req.body;

    // Get apps to process
    let apps: App[];
    if (app_id) {
      const app = await firestoreService.getApp(app_id);
      if (!app) {
        throw APIError.notFound('App');
      }
      apps = [app];
    } else {
      apps = await firestoreService.getApps();
    }

    const dailyBrief = await getDailyBrief();
    const briefConfig = {
      sendgrid: getSendGridConfig(),
      consoleUrl: config.consoleBaseUrl,
    };

    const results = [];

    for (const app of apps) {
      // Check if brief is enabled
      const schedule = app.schedules;
      const briefMode = schedule?.brief_mode || 'daily';

      if (!schedule && !force) {
        results.push({ appId: app.app_id, appName: app.name, skipped: 'No schedule configured' });
        continue;
      }

      // Get issues for this app
      const { issues } = await firestoreService.getIssues(
        { app_id: app.app_id },
        { field: 'severity', direction: 'asc' },
        1,
        100,
        null
      );

      // Filter to non-resolved issues
      const activeIssues = issues.filter((i) => i.status !== 'resolved');

      // Check "only on issues" mode
      if (briefMode === 'only_on_issues' && activeIssues.length === 0 && !force) {
        results.push({
          appId: app.app_id,
          appName: app.name,
          skipped: 'No active issues (only_on_issues mode)',
        });
        continue;
      }

      // Get stats
      const stats = await getAppStats(app.app_id, issues);

      // Run the brief
      const result = await dailyBrief.runDailyBriefForApp(app, activeIssues, briefConfig, stats);
      results.push(result);
    }

    res.json({
      data: {
        processed: results.length,
        results,
      },
    });
  })
);

/**
 * GET /briefs/preview/:app_id
 * Preview daily brief content for an app
 */
router.get(
  '/preview/:app_id',
  oauthAuth(true),
  requireRole('Admin', 'PO'),
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;

    const app = await firestoreService.getApp(app_id);
    if (!app) {
      throw APIError.notFound('App');
    }

    // Get issues
    const { issues } = await firestoreService.getIssues(
      { app_id },
      { field: 'severity', direction: 'asc' },
      1,
      100,
      null
    );

    // Filter to non-resolved
    const activeIssues = issues.filter((i) => i.status !== 'resolved');

    // Get stats
    const stats = await getAppStats(app_id, issues);

    const dailyBrief = await getDailyBrief();
    const briefConfig = {
      sendgrid: getSendGridConfig(),
      consoleUrl: config.consoleBaseUrl,
    };

    const preview = dailyBrief.previewDailyBrief(app, activeIssues, briefConfig, stats);

    res.json({
      data: {
        app_id: app.app_id,
        app_name: app.name,
        active_issues: activeIssues.length,
        ...preview,
      },
    });
  })
);

/**
 * POST /briefs/test/:app_id
 * Send test brief to requesting user
 */
router.post(
  '/test/:app_id',
  oauthAuth(true),
  requireRole('Admin', 'PO'),
  asyncHandler(async (req, res) => {
    const { app_id } = req.params;
    const userEmail = req.auth!.user!.email;

    if (!config.sendgridApiKey) {
      throw APIError.badRequest('SendGrid is not configured on this server');
    }

    const app = await firestoreService.getApp(app_id);
    if (!app) {
      throw APIError.notFound('App');
    }

    // Get issues
    const { issues } = await firestoreService.getIssues(
      { app_id },
      { field: 'severity', direction: 'asc' },
      1,
      100,
      null
    );

    const activeIssues = issues.filter((i) => i.status !== 'resolved');
    const stats = await getAppStats(app_id, issues);

    const dailyBrief = await getDailyBrief();
    const briefConfig = {
      sendgrid: getSendGridConfig(),
      consoleUrl: config.consoleBaseUrl,
    };

    // Generate brief data
    const briefData = dailyBrief.generateBriefData(app, activeIssues, briefConfig, stats);

    // Send to just the requesting user
    const sendResults = await dailyBrief.sendBriefToRecipients(
      [userEmail],
      briefData,
      briefConfig.sendgrid
    );

    await logAuditAction(req, 'send_test_brief', 'app', app_id, {
      recipient: userEmail,
      issues_included: briefData.issues.length,
    });

    res.json({
      data: {
        sent: sendResults.sent > 0,
        to: userEmail,
        issues_included: briefData.issues.length,
        error: sendResults.results[userEmail]?.error,
      },
    });
  })
);

export default router;
