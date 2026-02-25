/**
 * Issue routes tests - Assignment, resolution notes, comments
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMockIssue, createMockApp, createMockComment, resetIdCounter } from './test-utils.js';

// Mock firestore service
vi.mock('../services/firestore.js', () => ({
  getIssue: vi.fn(),
  updateIssue: vi.fn(),
  getApp: vi.fn(),
  getEventsByIssue: vi.fn(),
  createComment: vi.fn(),
  getComments: vi.fn().mockResolvedValue([]),
  getAllUsers: vi.fn().mockResolvedValue([]),
  createNotifications: vi.fn().mockResolvedValue([]),
}));

// Mock email service - parseMentions uses real implementation
vi.mock('../services/email.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/email.js')>();
  return {
    ...original,
    sendResolvedNotification: vi.fn().mockResolvedValue({ success: true }),
    sendWontFixNotification: vi.fn().mockResolvedValue({ success: true }),
    sendCommentNotification: vi.fn().mockResolvedValue({ success: true }),
    sendTeamMentionNotification: vi.fn().mockResolvedValue({ success: true }),
  };
});

// Mock context generator
vi.mock('../services/context-generator.js', () => ({
  generateContextFile: vi.fn(),
  generateContextJSON: vi.fn(),
}));

// Mock config
vi.mock('../config.js', () => ({
  config: {
    anthropicApiKey: '',
    sendgridApiKey: 'test-key',
    sendgridFromEmail: 'test@britepulse.io',
  },
}));

// Mock middleware - bypass auth and RBAC for route testing
let mockAuthUser: {
  user_id: string;
  email: string;
  name: string;
  role: string;
  app_access: string[];
} = {
  user_id: 'user-1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'Admin',
  app_access: ['app-001'],
};

vi.mock('../middleware/index.js', () => ({
  asyncHandler: (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  APIError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { statusCode: 400 }),
    notFound: (resource: string) => Object.assign(new Error(`${resource} not found`), { statusCode: 404 }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { statusCode: 403 }),
  },
  oauthAuth: () => (req: any, _res: any, next: any) => {
    req.auth = { type: 'oauth', user: { ...mockAuthUser } };
    next();
  },
  requirePermission: () => (req: any, _res: any, next: any) => {
    req.auth = req.auth || { type: 'oauth', user: { ...mockAuthUser } };
    next();
  },
  canChangeIssueStatus: (req: any, _res: any, next: any) => {
    req.auth = req.auth || { type: 'oauth', user: { ...mockAuthUser } };
    next();
  },
  canChangeSeverity: (req: any, _res: any, next: any) => {
    req.auth = req.auth || { type: 'oauth', user: { ...mockAuthUser } };
    next();
  },
  getAccessibleAppIds: () => null, // null = no restriction (admin)
  autoAudit: () => (_req: any, _res: any, next: any) => next(),
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

import * as firestoreService from '../services/firestore.js';
import * as emailService from '../services/email.js';
import issuesRouter from '../routes/issues.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/issues', issuesRouter);
  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({ error: { message: err.message } });
  });
  return app;
}

describe('Issue Routes', () => {
  let app: express.Express;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
    // Reset to admin user
    mockAuthUser = {
      user_id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'Admin',
      app_access: ['app-001'],
    };
  });

  // ============ Assign Endpoint ============

  describe('POST /issues/:issue_id/actions/assign', () => {
    it('should allow Admin to reassign any issue', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        routing: { assigned_to: 'engineer@test.com' },
      });
      const updatedIssue = { ...issue, routing: { assigned_to: 'newperson@test.com' } };

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.updateIssue).mockResolvedValue(updatedIssue);

      const res = await request(app)
        .post('/issues/issue-1/actions/assign')
        .send({ assigned_to: 'newperson@test.com', reason: 'Reassigning' });

      expect(res.status).toBe(200);
      expect(firestoreService.updateIssue).toHaveBeenCalledWith('issue-1', {
        assigned_to: 'newperson@test.com',
        reason: 'Reassigning',
      });
    });

    it('should allow current assignee to reassign', async () => {
      // Set current user to the assignee (not admin)
      mockAuthUser = {
        user_id: 'user-2',
        email: 'engineer@test.com',
        name: 'Engineer',
        role: 'Engineer',
        app_access: ['app-001'],
      };

      const issue = createMockIssue({
        issue_id: 'issue-1',
        routing: { assigned_to: 'engineer@test.com' },
      });
      const updatedIssue = { ...issue, routing: { assigned_to: 'other@test.com' } };

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.updateIssue).mockResolvedValue(updatedIssue);

      const res = await request(app)
        .post('/issues/issue-1/actions/assign')
        .send({ assigned_to: 'other@test.com', reason: 'Handing off' });

      expect(res.status).toBe(200);
    });

    it('should deny reassignment by non-assignee non-admin', async () => {
      mockAuthUser = {
        user_id: 'user-3',
        email: 'random@test.com',
        name: 'Random',
        role: 'Engineer',
        app_access: ['app-001'],
      };

      const issue = createMockIssue({
        issue_id: 'issue-1',
        routing: { assigned_to: 'engineer@test.com' },
      });

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);

      const res = await request(app)
        .post('/issues/issue-1/actions/assign')
        .send({ assigned_to: 'other@test.com', reason: 'Stealing it' });

      expect(res.status).toBe(403);
      expect(firestoreService.updateIssue).not.toHaveBeenCalled();
    });

    it('should require assigned_to and reason fields', async () => {
      const res = await request(app)
        .post('/issues/issue-1/actions/assign')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ============ Set-Status with Resolution Note ============

  describe('POST /issues/:issue_id/actions/set-status', () => {
    it('should accept resolution_note when resolving', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        status: 'in_progress',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });
      const updatedIssue = { ...issue, status: 'resolved' as const, resolution_note: 'Fixed in v2.1' };

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.updateIssue).mockResolvedValue(updatedIssue);
      vi.mocked(firestoreService.getApp).mockResolvedValue(createMockApp());

      const res = await request(app)
        .post('/issues/issue-1/actions/set-status')
        .send({
          status: 'resolved',
          reason: 'Fixed the bug',
          resolution_note: 'Fixed in v2.1',
        });

      expect(res.status).toBe(200);

      // Verify updateIssue received the resolution_note
      expect(firestoreService.updateIssue).toHaveBeenCalledWith('issue-1', {
        status: 'resolved',
        reason: 'Fixed the bug',
        resolution_note: 'Fixed in v2.1',
      });

      // Verify email was sent with the note
      expect(emailService.sendResolvedNotification).toHaveBeenCalledWith(
        updatedIssue,
        expect.anything(),
        'Fixed in v2.1'
      );
    });

    it('should accept resolution_note when marking won\'t fix', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        status: 'triaged',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });
      const updatedIssue = { ...issue, status: 'wont_fix' as const };

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.updateIssue).mockResolvedValue(updatedIssue);
      vi.mocked(firestoreService.getApp).mockResolvedValue(createMockApp());

      const res = await request(app)
        .post('/issues/issue-1/actions/set-status')
        .send({
          status: 'wont_fix',
          reason: 'Not in scope',
          resolution_note: 'This is a known platform limitation.',
        });

      expect(res.status).toBe(200);
      expect(emailService.sendWontFixNotification).toHaveBeenCalledWith(
        updatedIssue,
        expect.anything(),
        'This is a known platform limitation.'
      );
    });

    it('should work without resolution_note (backwards compat)', async () => {
      const issue = createMockIssue({ issue_id: 'issue-1', status: 'in_progress' });
      const updatedIssue = { ...issue, status: 'resolved' as const };

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.updateIssue).mockResolvedValue(updatedIssue);

      const res = await request(app)
        .post('/issues/issue-1/actions/set-status')
        .send({ status: 'resolved', reason: 'Done' });

      expect(res.status).toBe(200);
      // No resolution_note should be in the update payload
      expect(firestoreService.updateIssue).toHaveBeenCalledWith('issue-1', {
        status: 'resolved',
        reason: 'Done',
      });
    });

    it('should not include resolution_note for non-terminal statuses', async () => {
      const issue = createMockIssue({ issue_id: 'issue-1', status: 'new' });
      const updatedIssue = { ...issue, status: 'triaged' as const };

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.updateIssue).mockResolvedValue(updatedIssue);

      const res = await request(app)
        .post('/issues/issue-1/actions/set-status')
        .send({
          status: 'triaged',
          reason: 'Triaging',
          resolution_note: 'This should be ignored',
        });

      expect(res.status).toBe(200);
      // resolution_note should not be passed for non-resolved/wont_fix status
      expect(firestoreService.updateIssue).toHaveBeenCalledWith('issue-1', {
        status: 'triaged',
        reason: 'Triaging',
      });
    });
  });

  // ============ Comments Endpoints ============

  describe('GET /issues/:issue_id/comments', () => {
    it('should return comments for an issue', async () => {
      const issue = createMockIssue({ issue_id: 'issue-1' });
      const comments = [
        createMockComment({ comment_id: 'c1', body: 'First comment' }),
        createMockComment({ comment_id: 'c2', body: 'Second comment', source: 'email' }),
      ];

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.getComments).mockResolvedValue(comments);

      const res = await request(app).get('/issues/issue-1/comments');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].body).toBe('First comment');
      expect(res.body.data[1].source).toBe('email');
    });

    it('should return 404 if issue not found', async () => {
      vi.mocked(firestoreService.getIssue).mockResolvedValue(null);

      const res = await request(app).get('/issues/nonexistent/comments');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /issues/:issue_id/comments', () => {
    it('should send email to reporter when @mentioned', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });
      const newComment = createMockComment({
        issue_id: 'issue-1',
        author_email: 'admin@test.com',
        body: '@reporter@test.com can you share more details?',
        source: 'console',
      });

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.createComment).mockResolvedValue(newComment);
      vi.mocked(firestoreService.getApp).mockResolvedValue(createMockApp());

      const res = await request(app)
        .post('/issues/issue-1/comments')
        .send({ body: '@reporter@test.com can you share more details?' });

      expect(res.status).toBe(200);

      // Verify comment stored with mentions
      expect(firestoreService.createComment).toHaveBeenCalledWith('issue-1', expect.objectContaining({
        mentions: ['reporter@test.com'],
      }));

      // Verify email was sent to reporter
      expect(emailService.sendCommentNotification).toHaveBeenCalledWith(
        issue,
        expect.anything(),
        newComment,
        undefined
      );
    });

    it('should send team mention notification to @mentioned team member', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });
      const newComment = createMockComment({
        issue_id: 'issue-1',
        author_email: 'admin@test.com',
        body: '@engineer@test.com please review',
        source: 'console',
      });

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.createComment).mockResolvedValue(newComment);
      vi.mocked(firestoreService.getApp).mockResolvedValue(createMockApp());
      vi.mocked(firestoreService.getAllUsers).mockResolvedValue([
        { user_id: 'u2', email: 'engineer@test.com', name: 'Engineer', role: 'Engineer', app_access: [], created_at: '', updated_at: '' },
      ] as any);

      const res = await request(app)
        .post('/issues/issue-1/comments')
        .send({ body: '@engineer@test.com please review' });

      expect(res.status).toBe(200);
      expect(emailService.sendTeamMentionNotification).toHaveBeenCalledWith(
        issue,
        expect.anything(),
        newComment,
        'engineer@test.com',
        undefined
      );
      // Reporter should NOT be emailed (not mentioned)
      expect(emailService.sendCommentNotification).not.toHaveBeenCalled();
    });

    it('should not send any email when no @mentions', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.createComment).mockResolvedValue(createMockComment());

      await request(app)
        .post('/issues/issue-1/comments')
        .send({ body: 'Just a note to self' });

      expect(emailService.sendCommentNotification).not.toHaveBeenCalled();
      expect(emailService.sendTeamMentionNotification).not.toHaveBeenCalled();
    });

    it('should send email for self-mention', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-1',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });

      vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
      vi.mocked(firestoreService.createComment).mockResolvedValue(createMockComment());
      vi.mocked(firestoreService.getApp).mockResolvedValue(createMockApp());
      vi.mocked(firestoreService.getAllUsers).mockResolvedValue([
        { user_id: 'u1', email: 'admin@test.com', name: 'Admin', role: 'Admin', app_access: [], created_at: '', updated_at: '' },
      ] as any);

      await request(app)
        .post('/issues/issue-1/comments')
        .send({ body: '@admin@test.com reminder for myself' });

      // Author is admin@test.com, mention is admin@test.com — should still send
      expect(emailService.sendTeamMentionNotification).toHaveBeenCalledWith(
        issue, expect.anything(), expect.anything(), 'admin@test.com', undefined
      );
    });

    it('should reject empty comment body', async () => {
      const res = await request(app)
        .post('/issues/issue-1/comments')
        .send({ body: '' });

      expect(res.status).toBe(400);
    });

    it('should reject missing body field', async () => {
      const res = await request(app)
        .post('/issues/issue-1/comments')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
