/**
 * Request context middleware
 * Adds request ID and timing to each request
 */

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}

/**
 * Add request context (ID and timing) to each request
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  // Generate or use provided request ID
  req.requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.startTime = Date.now();

  // Add request ID to response headers
  res.setHeader('X-Request-ID', req.requestId);

  // Log request start (in production, use proper logging)
  console.log(`[${req.requestId}] ${req.method} ${req.path}`);

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    console.log(`[${req.requestId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
