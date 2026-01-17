/**
 * Zod schemas for Issue entities
 */

import { z } from 'zod';
import {
  EnvironmentSchema,
  IssueStatusSchema,
  IssueTypeSchema,
  SeveritySchema,
} from './enums.js';

export const IssueCountsSchema = z.object({
  occurrences_total: z.number().int().min(0),
  occurrences_24h: z.number().int().min(0),
  unique_users_24h_est: z.number().int().min(0),
});

export const IssueTimestampsSchema = z.object({
  created_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
});

export const IssueRoutingSchema = z.object({
  assigned_to: z.string().optional(),
});

export const IssueSchema = z.object({
  issue_id: z.string(),
  app_id: z.string(),
  environment: EnvironmentSchema,
  status: IssueStatusSchema,
  severity: SeveritySchema,
  title: z.string().min(1),
  description: z.string(),
  issue_type: IssueTypeSchema,
  primary_fingerprint: z.string().nullable(),
  event_refs: z.array(z.string()),
  counts: IssueCountsSchema,
  timestamps: IssueTimestampsSchema,
  routing: IssueRoutingSchema.optional(),
  tags: z.array(z.string()).optional(),
  related_issue_ids: z.array(z.string()).optional(),
  priority_score: z.number().optional(),
});

export const IssueInputSchema = z.object({
  app_id: z.string(),
  environment: EnvironmentSchema,
  title: z.string().min(1),
  description: z.string(),
  issue_type: IssueTypeSchema,
  severity: SeveritySchema.default('P2'),
  primary_fingerprint: z.string().optional(),
  initial_event_id: z.string(),
  tags: z.array(z.string()).optional(),
});

export const IssueUpdateInputSchema = z.object({
  status: IssueStatusSchema.optional(),
  severity: SeveritySchema.optional(),
  assigned_to: z.string().optional(),
  tags: z.array(z.string()).optional(),
  reason: z.string().min(1), // required for audit
});

export const IssueActionSchema = z.enum([
  'set-status',
  'set-severity',
  'assign',
  'request-info',
  'create-ticket',
  'resolve',
]);

export const IssueActionPayloadSchema = z.object({
  action: IssueActionSchema,
  reason: z.string().min(1),
  new_status: IssueStatusSchema.optional(),
  new_severity: SeveritySchema.optional(),
  assigned_to: z.string().optional(),
  ticket_url: z.string().url().optional(),
  request_info_message: z.string().optional(),
});

export const IssueFiltersSchema = z.object({
  app_id: z.string().optional(),
  environment: EnvironmentSchema.optional(),
  status: z.union([IssueStatusSchema, z.array(IssueStatusSchema)]).optional(),
  severity: z.union([SeveritySchema, z.array(SeveritySchema)]).optional(),
  issue_type: z.union([IssueTypeSchema, z.array(IssueTypeSchema)]).optional(),
  assigned_to: z.string().optional(),
  tag: z.string().optional(),
  version: z.string().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  last_seen_after: z.string().datetime().optional(),
  search: z.string().optional(),
});

export const IssueSortFieldSchema = z.enum([
  'priority_score',
  'severity',
  'occurrences_24h',
  'unique_users_24h_est',
  'last_seen_at',
  'created_at',
]);

export const IssueSortOptionsSchema = z.object({
  field: IssueSortFieldSchema.default('priority_score'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const IssueListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: IssueSortFieldSchema.default('priority_score'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
  ...IssueFiltersSchema.shape,
});
