/**
 * Inbound email webhook tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMockIssue, createMockComment, resetIdCounter } from './test-utils.js';

// Mock firestore
vi.mock('../services/firestore.js', () => ({
  getIssue: vi.fn(),
  createComment: vi.fn(),
  getAllUsers: vi.fn().mockResolvedValue([]),
}));

// Mock config
vi.mock('../config.js', () => ({
  config: {
    inboundEmailSecret: 'test-secret-token',
    inboundEmailDomain: 'reply.test.britepulse.io',
  },
}));

import * as firestoreService from '../services/firestore.js';
import inboundEmailRouter from '../routes/inbound-email.js';

function createApp() {
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use('/webhooks/inbound-email', inboundEmailRouter);
  return app;
}

describe('Inbound Email Webhook', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createApp();
    vi.clearAllMocks();
    resetIdCounter();
  });

  it('should reject requests without valid token', async () => {
    const res = await request(app)
      .post('/webhooks/inbound-email?token=wrong-token')
      .send({ from: 'a@b.com', to: 'issue+123@reply.test.britepulse.io', text: 'hello' });

    expect(res.status).toBe(401);
    expect(firestoreService.createComment).not.toHaveBeenCalled();
  });

  it('should reject requests without token', async () => {
    const res = await request(app)
      .post('/webhooks/inbound-email')
      .send({ from: 'a@b.com', to: 'issue+123@reply.test.britepulse.io', text: 'hello' });

    expect(res.status).toBe(401);
  });

  it('should create comment from valid email reply', async () => {
    const issue = createMockIssue({
      issue_id: 'abc-def-123',
      reported_by: { user_id: 'u1', email: 'reporter@example.com' },
    });
    const comment = createMockComment({
      source: 'email',
      author_email: 'reporter@example.com',
      body: 'Here are the details you asked for.',
    });

    vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
    vi.mocked(firestoreService.createComment).mockResolvedValue(comment);

    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: 'Reporter <reporter@example.com>',
        to: 'issue+abc-def-123@reply.test.britepulse.io',
        text: 'Here are the details you asked for.',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(firestoreService.createComment).toHaveBeenCalledWith('abc-def-123', expect.objectContaining({
      issue_id: 'abc-def-123',
      author_email: 'reporter@example.com',
      body: 'Here are the details you asked for.',
      source: 'email',
    }));
  });

  it('should strip quoted reply text', async () => {
    const issue = createMockIssue({
      issue_id: 'abc-123',
      reported_by: { user_id: 'u1', email: 'reporter@example.com' },
    });

    vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
    vi.mocked(firestoreService.createComment).mockResolvedValue(createMockComment());

    const emailText = `This is my reply with new info.

On Feb 20, 2026 at 10:00 AM, Test App wrote:
> There's a new comment on your feedback for Test App
> Alice commented:
> Can you share more details?`;

    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: 'reporter@example.com',
        to: 'issue+abc-123@reply.test.britepulse.io',
        text: emailText,
      });

    expect(res.status).toBe(200);
    // Should only contain the new content, not the quoted reply
    const commentBody = vi.mocked(firestoreService.createComment).mock.calls[0][1].body;
    expect(commentBody).toBe('This is my reply with new info.');
    expect(commentBody).not.toContain('Alice commented');
  });

  it('should reject sender that does not match issue reporter (anti-spoofing)', async () => {
    const issue = createMockIssue({
      issue_id: 'abc-123',
      reported_by: { user_id: 'u1', email: 'real-reporter@example.com' },
    });

    vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);

    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: 'attacker@evil.com',
        to: 'issue+abc-123@reply.test.britepulse.io',
        text: 'Trying to impersonate',
      });

    expect(res.status).toBe(200); // 200 to prevent SendGrid retries
    expect(res.body.reason).toBe('sender_mismatch');
    expect(firestoreService.createComment).not.toHaveBeenCalled();
  });

  it('should handle non-existent issue gracefully', async () => {
    vi.mocked(firestoreService.getIssue).mockResolvedValue(null);

    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: 'reporter@example.com',
        to: 'issue+00000000-0000-0000-0000-000000000000@reply.test.britepulse.io',
        text: 'Hello',
      });

    expect(res.status).toBe(200);
    expect(res.body.reason).toBe('issue_not_found');
    expect(firestoreService.createComment).not.toHaveBeenCalled();
  });

  it('should ignore email with unrecognized to address format', async () => {
    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: 'reporter@example.com',
        to: 'random@reply.test.britepulse.io',
        text: 'Hello',
      });

    expect(res.status).toBe(400);
    expect(firestoreService.getIssue).not.toHaveBeenCalled();
  });

  it('should ignore empty reply body after stripping quotes', async () => {
    const issue = createMockIssue({
      issue_id: 'abc-123',
      reported_by: { user_id: 'u1', email: 'reporter@example.com' },
    });

    vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);

    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: 'reporter@example.com',
        to: 'issue+abc-123@reply.test.britepulse.io',
        text: '> This is all quoted text\n> nothing new',
      });

    expect(res.status).toBe(200);
    expect(res.body.reason).toBe('empty_body');
    expect(firestoreService.createComment).not.toHaveBeenCalled();
  });

  it('should extract email from angle-bracket format', async () => {
    const issue = createMockIssue({
      issue_id: 'abc-123',
      reported_by: { user_id: 'u1', email: 'user@test.com' },
    });

    vi.mocked(firestoreService.getIssue).mockResolvedValue(issue);
    vi.mocked(firestoreService.createComment).mockResolvedValue(createMockComment());

    const res = await request(app)
      .post('/webhooks/inbound-email?token=test-secret-token')
      .type('form')
      .send({
        from: '"John Doe" <user@test.com>',
        to: '"Issue Discussion" <issue+abc-123@reply.test.britepulse.io>',
        text: 'My reply',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    const commentInput = vi.mocked(firestoreService.createComment).mock.calls[0][1];
    expect(commentInput.author_email).toBe('user@test.com');
  });
});
