/**
 * Zod schemas for User entities
 */

import { z } from 'zod';
import { UserRoleSchema } from './enums.js';

export const UserSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: UserRoleSchema,
  app_access: z.array(z.string()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_login_at: z.string().datetime().optional(),
});

export const UserSessionSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: UserRoleSchema,
  app_access: z.array(z.string()),
  session_id: z.string(),
  expires_at: z.string().datetime(),
});

export const UserInputSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: UserRoleSchema,
  app_access: z.array(z.string()),
});

export const UpdateUserRoleInputSchema = z.object({
  role: UserRoleSchema,
  reason: z.string().min(1),
});

export const UpdateUserAccessInputSchema = z.object({
  app_access: z.array(z.string()),
  reason: z.string().min(1),
});
