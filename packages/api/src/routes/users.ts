/**
 * User management routes
 * Admin-only user CRUD operations
 */

import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { asyncHandler, APIError, oauthAuth, requireAdmin, logAuditAction } from '../middleware/index.js';
import * as firestoreService from '../services/firestore.js';

const router: IRouter = Router();

// All user routes require OAuth authentication and Admin role
router.use(oauthAuth(true));
router.use(requireAdmin);

// Input schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['Admin', 'PO', 'Engineer', 'ReadOnly']),
  app_access: z.array(z.string()).default([]),
});

const UpdateUserSchema = z.object({
  name: z.string().optional(),
  role: z.enum(['Admin', 'PO', 'Engineer', 'ReadOnly']).optional(),
  app_access: z.array(z.string()).optional(),
});

/**
 * GET /admin/users
 * List all users (Admin only)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await firestoreService.getAllUsers();

    await logAuditAction(req, 'view_user_list', 'user', 'all', {});

    res.json({
      data: users,
      meta: {
        total: users.length,
      },
    });
  })
);

/**
 * POST /admin/users
 * Create a new user (Admin only)
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parseResult = CreateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    // Check if user already exists
    const existingUser = await firestoreService.getUserByEmail(parseResult.data.email);
    if (existingUser) {
      throw APIError.conflict('User with this email already exists');
    }

    const user = await firestoreService.createUser(parseResult.data);

    await logAuditAction(req, 'create_user', 'user', user.user_id, {
      email: user.email,
      role: user.role,
    });

    res.status(201).json({ data: user });
  })
);

/**
 * GET /admin/users/:user_id
 * Get a single user by ID (Admin only)
 */
router.get(
  '/:user_id',
  asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const user = await firestoreService.getUser(user_id);
    if (!user) {
      throw APIError.notFound('User');
    }

    res.json({ data: user });
  })
);

/**
 * PATCH /admin/users/:user_id
 * Update a user (Admin only)
 */
router.patch(
  '/:user_id',
  asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const parseResult = UpdateUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw APIError.badRequest('Invalid request body', {
        issues: parseResult.error.issues,
      });
    }

    const existingUser = await firestoreService.getUser(user_id);
    if (!existingUser) {
      throw APIError.notFound('User');
    }

    // Prevent admin from demoting themselves
    const currentUserId = req.auth!.user!.user_id;
    if (user_id === currentUserId && parseResult.data.role && parseResult.data.role !== 'Admin') {
      throw APIError.badRequest('Cannot demote yourself from Admin role');
    }

    const user = await firestoreService.updateUser(user_id, parseResult.data);

    await logAuditAction(req, 'update_user', 'user', user_id, {
      changed_fields: Object.keys(parseResult.data),
      previous_role: existingUser.role,
      new_role: parseResult.data.role,
    });

    res.json({ data: user });
  })
);

/**
 * DELETE /admin/users/:user_id
 * Delete a user (Admin only)
 */
router.delete(
  '/:user_id',
  asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    const existingUser = await firestoreService.getUser(user_id);
    if (!existingUser) {
      throw APIError.notFound('User');
    }

    // Prevent admin from deleting themselves
    const currentUserId = req.auth!.user!.user_id;
    if (user_id === currentUserId) {
      throw APIError.badRequest('Cannot delete yourself');
    }

    await firestoreService.deleteUser(user_id);

    await logAuditAction(req, 'delete_user', 'user', user_id, {
      deleted_email: existingUser.email,
      deleted_role: existingUser.role,
    });

    res.json({
      data: {
        success: true,
        message: 'User deleted successfully',
      },
    });
  })
);

export default router;
