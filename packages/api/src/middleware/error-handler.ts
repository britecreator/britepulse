/**
 * Global error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HTTP_STATUS } from '@britepulse/shared';

/**
 * Custom API error class
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'APIError';
  }

  static badRequest(message: string, details?: Record<string, unknown>): APIError {
    return new APIError(HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required'): APIError {
    return new APIError(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Access denied'): APIError {
    return new APIError(HTTP_STATUS.FORBIDDEN, 'FORBIDDEN', message);
  }

  static notFound(resource = 'Resource'): APIError {
    return new APIError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND', `${resource} not found`);
  }

  static conflict(message: string): APIError {
    return new APIError(HTTP_STATUS.CONFLICT, 'CONFLICT', message);
  }

  static tooManyRequests(message = 'Rate limit exceeded'): APIError {
    return new APIError(HTTP_STATUS.TOO_MANY_REQUESTS, 'RATE_LIMITED', message);
  }

  static internal(message = 'Internal server error'): APIError {
    return new APIError(HTTP_STATUS.INTERNAL_ERROR, 'INTERNAL_ERROR', message);
  }
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error (in production, use proper logging)
  console.error('[Error]', err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          issues: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      },
    });
    return;
  }

  // Handle custom API errors
  if (err instanceof APIError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle unknown errors (don't leak details in production)
  res.status(HTTP_STATUS.INTERNAL_ERROR).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

/**
 * Async handler wrapper to catch promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
