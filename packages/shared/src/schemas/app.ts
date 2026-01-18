/**
 * Zod schemas for App configuration entities
 */

import { z } from 'zod';
import { RedactionProfileSchema, SeveritySchema, UserRoleSchema } from './enums.js';

export const EnvironmentConfigSchema = z.object({
  env_name: z.string().min(1),
  enabled: z.boolean(),
  daily_brief_enabled: z.boolean().default(true),
  ai_enabled: z.boolean().default(true),
});

export const RepoMappingSchema = z.object({
  repo_id: z.string().min(1),
  services: z.array(z.string()),
  ownership_reviewers: z.array(z.string().email()),
  path_scopes: z.array(z.string()).optional(),
});

export const InstallKeysSchema = z.object({
  public_key: z.string().min(32),
  server_key: z.string().min(32),
  key_rotated_at: z.string().datetime(),
});

export const AttachmentPolicySchema = z.object({
  allowed: z.boolean().default(true),
  restricted_roles: z.array(UserRoleSchema).default(['ReadOnly']),
});

export const AIPolicySchema = z.object({
  eligible_severity_min: SeveritySchema.default('P1'),
  eligible_recurrence_min: z.number().int().min(1).default(5),
  model_allowed_inputs: z
    .array(z.string())
    .default([
      'sanitized_feedback',
      'sanitized_stack',
      'retrieved_code_excerpts',
      'metrics_summary',
    ]),
});

export const SamplingRuleSchema = z.object({
  route_pattern: z.string().optional(),
  sample_rate: z.number().min(0).max(1),
});

export const TelemetryPolicySchema = z.object({
  frontend_enabled: z.boolean().default(true),
  backend_enabled: z.boolean().default(true),
  sampling_rules: z.array(SamplingRuleSchema).default([]),
});

export const PolicySchema = z.object({
  redaction_profile: RedactionProfileSchema.default('standard'),
  attachment_policy: AttachmentPolicySchema.default({
    allowed: true,
    restricted_roles: ['ReadOnly'],
  }),
  ai_policy: AIPolicySchema.default({
    eligible_severity_min: 'P1',
    eligible_recurrence_min: 5,
    model_allowed_inputs: [
      'sanitized_feedback',
      'sanitized_stack',
      'retrieved_code_excerpts',
      'metrics_summary',
    ],
  }),
  telemetry_policy: TelemetryPolicySchema.default({
    frontend_enabled: true,
    backend_enabled: true,
    sampling_rules: [],
  }),
});

export const BriefModeSchema = z.enum(['daily', 'only_on_issues']);

export const ScheduleSchema = z.object({
  daily_brief_time_local: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Must be in HH:MM format',
  }),
  daily_brief_timezone: z.string().default('America/Chicago'),
  daily_brief_max_items: z.number().int().min(1).max(50).default(10),
  daily_brief_min_items: z.number().int().min(1).max(50).default(5),
  daily_brief_recipients: z.array(z.string().email()),
  brief_mode: BriefModeSchema.optional().default('daily'),
});

export const AppOwnersSchema = z.object({
  po_emails: z.array(z.string().email()).min(1),
  engineering_owner_group: z.union([z.string(), z.array(z.string())]).optional(),
});

export const AppSchema = z.object({
  app_id: z.string().min(1),
  name: z.string().min(1),
  environments: z.array(EnvironmentConfigSchema).min(1),
  base_url_patterns: z.array(z.string()).min(1),
  owners: AppOwnersSchema,
  repo_mapping: z.array(RepoMappingSchema).optional(),
  policies: PolicySchema.optional(),
  schedules: ScheduleSchema.optional(),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export const CreateAppInputSchema = z.object({
  name: z.string().min(1),
  environments: z.array(EnvironmentConfigSchema).min(1),
  base_url_patterns: z.array(z.string()).min(1),
  owners: AppOwnersSchema,
  repo_mapping: z.array(RepoMappingSchema).optional(),
  policies: PolicySchema.optional(),
  schedules: ScheduleSchema.optional(),
});

export const UpdateAppInputSchema = z.object({
  name: z.string().min(1).optional(),
  environments: z.array(EnvironmentConfigSchema).optional(),
  base_url_patterns: z.array(z.string()).optional(),
});

export const UpdateOwnersInputSchema = AppOwnersSchema;

export const UpdatePoliciesInputSchema = PolicySchema.partial();

export const UpdateSchedulesInputSchema = ScheduleSchema.partial();
