/**
 * Pipeline tests - Auto-assignment to first product owner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockApp, createMockEvent, createMockIssue, resetIdCounter } from './test-utils.js';

// Mock firestore service
vi.mock('../services/firestore.js', () => ({
  getApp: vi.fn(),
  createIssue: vi.fn(),
  createEvent: vi.fn(),
  findIssueByFingerprint: vi.fn(),
  getIssue: vi.fn(),
  addEventToIssue: vi.fn(),
  updateIssue: vi.fn(),
  updateEvent: vi.fn(),
  getEventsByIssue: vi.fn(),
}));

// Mock other pipeline dependencies
vi.mock('../services/redaction.js', () => ({
  redactObject: vi.fn((data) => ({ data, redactionsApplied: 0 })),
}));

vi.mock('../services/fingerprint.js', () => ({
  extractFingerprintInput: vi.fn(() => null),
  generateFingerprint: vi.fn(() => 'test-fingerprint'),
}));

vi.mock('../services/storage.js', () => ({
  isStorageConfigured: vi.fn(() => false),
}));

vi.mock('../config.js', () => ({
  config: {
    anthropicApiKey: '',
  },
}));

import * as firestoreService from '../services/firestore.js';
import { processEvent } from '../services/pipeline.js';

describe('Pipeline - Auto-assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounter();
  });

  it('should auto-assign new feedback issues to the first product owner', async () => {
    const app = createMockApp({
      app_id: 'app-001',
      owners: { po_emails: ['lead-po@test.com', 'second-po@test.com'] },
    });
    const event = createMockEvent({ app_id: 'app-001' });
    const issue = createMockIssue({ app_id: 'app-001' });

    vi.mocked(firestoreService.createEvent).mockResolvedValue(event);
    vi.mocked(firestoreService.getApp).mockResolvedValue(app);
    vi.mocked(firestoreService.createIssue).mockResolvedValue(issue);

    await processEvent(event);

    // Verify createIssue was called with routing containing the first PO
    expect(firestoreService.createIssue).toHaveBeenCalledTimes(1);
    const issueInput = vi.mocked(firestoreService.createIssue).mock.calls[0][0];
    expect(issueInput.routing).toEqual({ assigned_to: 'lead-po@test.com' });
  });

  it('should not set routing when app has no owners', async () => {
    const app = createMockApp({
      app_id: 'app-001',
      owners: { po_emails: [] },
    });
    const event = createMockEvent({ app_id: 'app-001' });
    const issue = createMockIssue({ app_id: 'app-001' });

    vi.mocked(firestoreService.createEvent).mockResolvedValue(event);
    vi.mocked(firestoreService.getApp).mockResolvedValue(app);
    vi.mocked(firestoreService.createIssue).mockResolvedValue(issue);

    await processEvent(event);

    const issueInput = vi.mocked(firestoreService.createIssue).mock.calls[0][0];
    expect(issueInput.routing).toBeUndefined();
  });

  it('should not set routing when app is not found', async () => {
    const event = createMockEvent({ app_id: 'nonexistent-app' });
    const issue = createMockIssue();

    vi.mocked(firestoreService.createEvent).mockResolvedValue(event);
    vi.mocked(firestoreService.getApp).mockResolvedValue(null);
    vi.mocked(firestoreService.createIssue).mockResolvedValue(issue);

    await processEvent(event);

    const issueInput = vi.mocked(firestoreService.createIssue).mock.calls[0][0];
    expect(issueInput.routing).toBeUndefined();
  });

  it('should not auto-assign when event groups into existing issue', async () => {
    const event = createMockEvent({
      app_id: 'app-001',
      event_type: 'frontend_error',
      payload: { error_type: 'TypeError', message: 'test' },
    });
    const existingIssue = createMockIssue({
      app_id: 'app-001',
      primary_fingerprint: 'test-fingerprint',
    });

    // Mock fingerprinting to return a value
    const { extractFingerprintInput } = await import('../services/fingerprint.js');
    vi.mocked(extractFingerprintInput).mockReturnValue({ error_type: 'TypeError', message: 'test' });

    vi.mocked(firestoreService.createEvent).mockResolvedValue(event);
    vi.mocked(firestoreService.findIssueByFingerprint).mockResolvedValue(existingIssue);
    vi.mocked(firestoreService.getIssue).mockResolvedValue(existingIssue);
    vi.mocked(firestoreService.addEventToIssue).mockResolvedValue(undefined);

    await processEvent(event);

    // createIssue should NOT be called — event grouped into existing issue
    expect(firestoreService.createIssue).not.toHaveBeenCalled();
    expect(firestoreService.addEventToIssue).toHaveBeenCalledWith(existingIssue.issue_id, event.event_id);
  });
});
