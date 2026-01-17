/**
 * Zod schemas for Audit Log entities
 */

import { z } from 'zod';
import { AuditTargetTypeSchema, UserRoleSchema } from './enums.js';

export const AuditMetadataSchema = z
  .object({
    previous_value: z.string().optional(),
    new_value: z.string().optional(),
    reason: z.string().optional(),
    assigned_from: z.string().optional(),
    assigned_to: z.string().optional(),
    changed_fields: z.array(z.string()).optional(),
    key_type: z.enum(['public', 'server']).optional(),
    environment: z.string().optional(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
    request_id: z.string().optional(),
  })
  .passthrough(); // Allow additional fields

export const AuditLogSchema = z.object({
  audit_id: z.string(),
  actor_id: z.string(),
  actor_role: z.union([UserRoleSchema, z.literal('system')]),
  action: z.string(),
  target_type: AuditTargetTypeSchema,
  target_id: z.string(),
  timestamp: z.string().datetime(),
  metadata: AuditMetadataSchema,
});

export const AuditLogInputSchema = z.object({
  actor_id: z.string(),
  actor_role: z.union([UserRoleSchema, z.literal('system')]),
  action: z.string(),
  target_type: AuditTargetTypeSchema,
  target_id: z.string(),
  metadata: AuditMetadataSchema.optional(),
});

export const AuditLogFiltersSchema = z.object({
  actor_id: z.string().optional(),
  actor_role: z.union([UserRoleSchema, z.literal('system')]).optional(),
  action: z.string().optional(),
  target_type: AuditTargetTypeSchema.optional(),
  target_id: z.string().optional(),
  after: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
});

export const AuditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(50),
  ...AuditLogFiltersSchema.shape,
});
