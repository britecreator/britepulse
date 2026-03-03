/**
 * Context Generator tests - Attachment URL inclusion in AI agent downloads
 */

import { describe, it, expect } from 'vitest';
import { generateContextFile, generateContextJSON } from '../services/context-generator.js';
import { createMockIssue, createMockApp, createMockEvent } from './test-utils.js';

const baseIssue = createMockIssue({ issue_type: 'feedback' });
const baseApp = createMockApp();

const eventWithAttachment = createMockEvent({
  event_id: 'evt-001',
  event_type: 'feedback',
  attachment_refs: ['att-001'],
});
const eventWithoutAttachment = createMockEvent({ event_id: 'evt-002', event_type: 'feedback' });

const mockAttachmentUrls = [
  {
    attachment_id: 'att-001',
    event_id: 'evt-001',
    filename: 'screenshot.png',
    url: 'https://storage.example.com/signed?token=abc123',
  },
];

// ============ generateContextFile ============

describe('generateContextFile - Attachments section', () => {
  it('renders inline images when attachmentUrls are provided', () => {
    const md = generateContextFile({
      issue: baseIssue,
      events: [eventWithAttachment],
      app: baseApp,
      attachmentUrls: mockAttachmentUrls,
    });

    expect(md).toContain('## Attachments');
    expect(md).toContain('![screenshot.png](https://storage.example.com/signed?token=abc123)');
    expect(md).toContain('time-limited signed links valid for 24 hours');
    // Should NOT show the fallback console link
    expect(md).not.toContain('View attachments in the BritePulse console');
  });

  it('falls back to console link when attachmentUrls is empty', () => {
    const md = generateContextFile({
      issue: baseIssue,
      events: [eventWithAttachment],
      app: baseApp,
      attachmentUrls: [],
    });

    expect(md).toContain('## Attachments');
    expect(md).toContain('View attachments in the BritePulse console under the Events tab');
    expect(md).not.toContain('![');
  });

  it('falls back to console link when attachmentUrls is omitted (storage not configured)', () => {
    const md = generateContextFile({
      issue: baseIssue,
      events: [eventWithAttachment],
      app: baseApp,
      // attachmentUrls intentionally omitted
    });

    expect(md).toContain('View attachments in the BritePulse console under the Events tab');
    expect(md).not.toContain('![');
  });

  it('omits the Attachments section entirely when no events have attachments', () => {
    const md = generateContextFile({
      issue: baseIssue,
      events: [eventWithoutAttachment],
      app: baseApp,
      attachmentUrls: mockAttachmentUrls,
    });

    expect(md).not.toContain('## Attachments');
  });

  it('renders multiple images when multiple attachments are provided', () => {
    const twoUrls = [
      ...mockAttachmentUrls,
      { attachment_id: 'att-002', event_id: 'evt-001', filename: 'before.jpg', url: 'https://storage.example.com/before' },
    ];
    const md = generateContextFile({
      issue: baseIssue,
      events: [{ ...eventWithAttachment, attachment_refs: ['att-001', 'att-002'] }],
      app: baseApp,
      attachmentUrls: twoUrls,
    });

    expect(md).toContain('![screenshot.png]');
    expect(md).toContain('![before.jpg]');
  });
});

// ============ generateContextJSON ============

describe('generateContextJSON - Attachments field', () => {
  it('includes images array with URLs when attachmentUrls are provided', () => {
    const json = generateContextJSON({
      issue: baseIssue,
      events: [eventWithAttachment],
      app: baseApp,
      attachmentUrls: mockAttachmentUrls,
    }) as Record<string, any>;

    expect(json.attachments).toBeDefined();
    expect(json.attachments.events_with_attachments).toBe(1);
    expect(json.attachments.images).toHaveLength(1);
    expect(json.attachments.images[0]).toMatchObject({
      attachment_id: 'att-001',
      event_id: 'evt-001',
      filename: 'screenshot.png',
      url: 'https://storage.example.com/signed?token=abc123',
      url_note: 'Time-limited signed URL valid for 24 hours',
    });
    expect(json.attachments.note).toBeUndefined();
  });

  it('falls back to note when attachmentUrls is empty', () => {
    const json = generateContextJSON({
      issue: baseIssue,
      events: [eventWithAttachment],
      app: baseApp,
      attachmentUrls: [],
    }) as Record<string, any>;

    expect(json.attachments.note).toContain('BritePulse console');
    expect(json.attachments.images).toBeUndefined();
  });

  it('falls back to note when attachmentUrls is omitted', () => {
    const json = generateContextJSON({
      issue: baseIssue,
      events: [eventWithAttachment],
      app: baseApp,
    }) as Record<string, any>;

    expect(json.attachments.note).toContain('BritePulse console');
    expect(json.attachments.images).toBeUndefined();
  });

  it('omits attachments field when no events have attachment_refs', () => {
    const json = generateContextJSON({
      issue: baseIssue,
      events: [eventWithoutAttachment],
      app: baseApp,
      attachmentUrls: mockAttachmentUrls,
    }) as Record<string, any>;

    expect(json.attachments).toBeUndefined();
  });
});
