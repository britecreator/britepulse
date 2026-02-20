/**
 * Email service tests - Resolution notes and comment notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockIssue, createMockApp, createMockComment, resetIdCounter } from './test-utils.js';

// Mock SendGrid
const mockSend = vi.fn().mockResolvedValue([{ headers: { 'x-message-id': 'msg-123' } }]);
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

vi.mock('../config.js', () => ({
  config: {
    sendgridApiKey: 'test-api-key',
    sendgridFromEmail: 'test@britepulse.io',
    inboundEmailDomain: 'reply.test.britepulse.io',
  },
}));

import { sendResolvedNotification, sendWontFixNotification, sendCommentNotification } from '../services/email.js';

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
  });

  describe('sendResolvedNotification', () => {
    it('should send resolved email without resolution note', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1', email: 'user@test.com' } });
      const app = createMockApp({ name: 'My App' });

      const result = await sendResolvedNotification(issue, app);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const msg = mockSend.mock.calls[0][0];
      expect(msg.to).toBe('user@test.com');
      expect(msg.subject).toContain('Resolved');
      expect(msg.html).not.toContain('Note from the team');
      expect(msg.text).not.toContain('Note from the team');
    });

    it('should include resolution note in resolved email when provided', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1', email: 'user@test.com' } });
      const app = createMockApp({ name: 'My App' });

      const result = await sendResolvedNotification(issue, app, 'We fixed the login bug in v2.1');

      expect(result.success).toBe(true);
      const msg = mockSend.mock.calls[0][0];
      expect(msg.html).toContain('Note from the team');
      expect(msg.html).toContain('We fixed the login bug in v2.1');
      expect(msg.text).toContain('Note from the team');
      expect(msg.text).toContain('We fixed the login bug in v2.1');
    });

    it('should HTML-escape resolution note content', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1', email: 'user@test.com' } });
      const app = createMockApp();

      await sendResolvedNotification(issue, app, '<script>alert("xss")</script>');

      const msg = mockSend.mock.calls[0][0];
      expect(msg.html).not.toContain('<script>');
      expect(msg.html).toContain('&lt;script&gt;');
    });

    it('should return error when no reporter email', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1' } });
      const app = createMockApp();

      const result = await sendResolvedNotification(issue, app);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No reporter email');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('sendWontFixNotification', () => {
    it('should send won\'t fix email without resolution note', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1', email: 'user@test.com' } });
      const app = createMockApp();

      const result = await sendWontFixNotification(issue, app);

      expect(result.success).toBe(true);
      const msg = mockSend.mock.calls[0][0];
      expect(msg.html).toContain('After careful review');
      expect(msg.html).not.toContain('Note from the team');
    });

    it('should include resolution note in won\'t fix email and replace default text', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1', email: 'user@test.com' } });
      const app = createMockApp();

      const result = await sendWontFixNotification(issue, app, 'This is a known limitation of the platform.');

      expect(result.success).toBe(true);
      const msg = mockSend.mock.calls[0][0];
      expect(msg.html).toContain('Note from the team');
      expect(msg.html).toContain('This is a known limitation of the platform.');
      // When a note is provided, the default "After careful review" text is replaced
      expect(msg.html).not.toContain('After careful review');
      expect(msg.text).toContain('This is a known limitation of the platform.');
    });
  });

  describe('sendCommentNotification', () => {
    it('should send comment email with reply-to address', async () => {
      const issue = createMockIssue({
        issue_id: 'issue-abc-123',
        reported_by: { user_id: 'u1', email: 'reporter@test.com' },
      });
      const app = createMockApp({ name: 'Test App' });
      const comment = createMockComment({
        author_email: 'engineer@test.com',
        author_name: 'Alice Engineer',
        body: 'Can you share more details about the error?',
      });

      const result = await sendCommentNotification(issue, app, comment);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const msg = mockSend.mock.calls[0][0];
      expect(msg.to).toBe('reporter@test.com');
      expect(msg.subject).toContain('Re:');
      expect(msg.html).toContain('Alice Engineer');
      expect(msg.html).toContain('Can you share more details about the error?');
      expect(msg.text).toContain('Can you share more details about the error?');

      // Reply-To should contain the issue ID
      expect(msg.replyTo.email).toBe('issue+issue-abc-123@reply.test.britepulse.io');
    });

    it('should return error when no reporter email', async () => {
      const issue = createMockIssue({ reported_by: null });
      const app = createMockApp();
      const comment = createMockComment();

      const result = await sendCommentNotification(issue, app, comment);

      expect(result.success).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should HTML-escape comment body in HTML template', async () => {
      const issue = createMockIssue({ reported_by: { user_id: 'u1', email: 'r@test.com' } });
      const app = createMockApp();
      const comment = createMockComment({ body: '<img src=x onerror=alert(1)>' });

      await sendCommentNotification(issue, app, comment);

      const msg = mockSend.mock.calls[0][0];
      expect(msg.html).not.toContain('<img src=x');
      expect(msg.html).toContain('&lt;img');
    });
  });
});
