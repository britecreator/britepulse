/**
 * Health check routes
 */

import { Router, type IRouter } from 'express';
import type { HealthCheckResponse } from '@britepulse/shared';

const router: IRouter = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (_req, res) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    components: {
      database: 'ok', // TODO: Implement actual health checks
      queue: 'ok',
      ai_service: 'ok',
    },
  };

  res.json(response);
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes/Cloud Run
 */
router.get('/ready', (_req, res) => {
  // TODO: Check if all dependencies are ready
  res.json({ ready: true });
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes/Cloud Run
 */
router.get('/live', (_req, res) => {
  res.json({ alive: true });
});

export default router;
