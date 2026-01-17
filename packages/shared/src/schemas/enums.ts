/**
 * Zod schemas for enumeration types
 */

import { z } from 'zod';

export const SeveritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);

export const IssueStatusSchema = z.enum([
  'new',
  'triaged',
  'in_progress',
  'blocked',
  'snoozed',
  'resolved',
]);

export const EventTypeSchema = z.enum(['feedback', 'frontend_error', 'backend_error']);

export const IssueTypeSchema = z.enum(['bug', 'feature', 'feedback', 'question']);

export const UserRoleSchema = z.enum(['Admin', 'PO', 'Engineer', 'ReadOnly']);

export const RedactionProfileSchema = z.enum(['strict', 'standard', 'relaxed']);

export const NextActionSchema = z.enum([
  'investigate',
  'request_info',
  'route_engineering',
  'create_ticket',
  'monitor_only',
]);

export const AuditTargetTypeSchema = z.enum(['app', 'issue', 'event', 'attachment']);

export const EnvironmentSchema = z.string().min(1);
