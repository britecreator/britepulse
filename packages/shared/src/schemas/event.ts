/**
 * Zod schemas for Event entities
 */

import { z } from 'zod';
import { EnvironmentSchema, EventTypeSchema } from './enums.js';

export const EventUserSchema = z.object({
  user_id: z.string().default('unknown'),
  role: z.string().default('unknown'),
  email: z.string().email().optional(),
});

export const RequestMetadataSchema = z.object({
  request_id: z.string().optional(),
  service_name: z.string().optional(),
  revision: z.string().optional(),
  http_status: z.number().int().optional(),
});

export const FeedbackPayloadSchema = z.object({
  category: z.enum(['bug', 'feature', 'feedback']),
  description: z.string().min(1),
  reproduction_steps: z.string().optional(),
  allow_contact: z.boolean().optional(),
});

export const FrontendErrorPayloadSchema = z.object({
  error_type: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  component_stack: z.string().optional(),
  source_file: z.string().optional(),
  line_number: z.number().int().optional(),
  column_number: z.number().int().optional(),
});

export const BackendErrorPayloadSchema = z.object({
  error_type: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  service_name: z.string(),
  revision: z.string().optional(),
  endpoint: z.string().optional(),
  http_method: z.string().optional(),
  http_status: z.number().int().optional(),
});

export const EventPayloadSchema = z.union([
  FeedbackPayloadSchema,
  FrontendErrorPayloadSchema,
  BackendErrorPayloadSchema,
]);

export const EventSchema = z.object({
  event_id: z.string(),
  app_id: z.string(),
  environment: EnvironmentSchema,
  event_type: EventTypeSchema,
  timestamp: z.string().datetime(),
  session_id: z.string(),
  route_or_url: z.string(),
  version: z.string().default('unknown'),
  user: EventUserSchema,
  payload: z.record(z.unknown()),
  trace_id: z.string().optional(),
  fingerprint: z.string().optional(),
  attachment_refs: z.array(z.string()).optional(),
  request_metadata: RequestMetadataSchema.optional(),
});

export const EventInputSchema = z.object({
  event_type: EventTypeSchema,
  session_id: z.string().optional(),
  trace_id: z.string().optional(),
  route_or_url: z.string(),
  version: z.string().optional(),
  user: z
    .object({
      user_id: z.string().optional(),
      role: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  payload: z.record(z.unknown()),
  attachment_refs: z.array(z.string()).optional(),
  request_metadata: RequestMetadataSchema.optional(),
});

export const AttachmentSchema = z.object({
  attachment_id: z.string(),
  event_id: z.string(),
  app_id: z.string(),
  environment: EnvironmentSchema,
  filename: z.string(),
  content_type: z.string(),
  size_bytes: z.number().int().positive(),
  storage_path: z.string(),
  uploaded_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  user_opted_in: z.boolean(),
});

// Ingestion API schemas
export const AttachmentUploadSchema = z.object({
  filename: z.string().min(1),
  content_type: z.string().min(1),
  data: z.string().min(1), // base64
  user_opted_in: z.literal(true), // must be true
});

export const EventIngestionSchema = z.object({
  event_type: EventTypeSchema,
  timestamp: z.string().datetime().optional(),
  session_id: z.string().optional(),
  trace_id: z.string().optional(),
  route_or_url: z.string().min(1),
  version: z.string().optional(),
  user: z
    .object({
      user_id: z.string().optional(),
      role: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  payload: z.record(z.unknown()),
  attachments: z.array(AttachmentUploadSchema).optional(),
});

export const IngestEventRequestSchema = z.object({
  events: z.array(EventIngestionSchema).min(1).max(100),
});
