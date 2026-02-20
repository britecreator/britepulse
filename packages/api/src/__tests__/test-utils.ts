/**
 * Test utilities - Mock factories and helpers
 */

import { vi } from 'vitest';
import type { Issue, App, Event, IssueComment } from '@britepulse/shared';

// ============ Entity Factories ============

let counter = 0;
function nextId(): string {
  counter++;
  return `test-${counter.toString().padStart(4, '0')}-0000-0000-000000000000`;
}

export function resetIdCounter(): void {
  counter = 0;
}

export function createMockApp(overrides: Partial<App> = {}): App {
  return {
    app_id: nextId(),
    name: 'Test App',
    environments: [{ env_name: 'prod', enabled: true }],
    base_url_patterns: ['https://test.example.com'],
    owners: {
      po_emails: ['owner1@test.com', 'owner2@test.com'],
    },
    policies: { redaction_profile: 'standard' },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as App;
}

export function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    issue_id: nextId(),
    app_id: 'app-001',
    environment: 'prod',
    status: 'new',
    severity: 'P2',
    title: 'Test Issue',
    description: 'Test description',
    issue_type: 'feedback',
    primary_fingerprint: null,
    event_refs: ['evt-001'],
    counts: {
      occurrences_total: 1,
      occurrences_24h: 1,
      unique_users_24h_est: 1,
    },
    timestamps: {
      created_at: '2026-01-01T00:00:00.000Z',
      last_seen_at: '2026-01-01T00:00:00.000Z',
    },
    reported_by: {
      user_id: 'user-123',
      email: 'reporter@example.com',
    },
    tags: [],
    ...overrides,
  };
}

export function createMockEvent(overrides: Partial<Event> = {}): Event {
  return {
    event_id: nextId(),
    app_id: 'app-001',
    environment: 'prod',
    event_type: 'feedback',
    timestamp: '2026-01-01T00:00:00.000Z',
    route_or_url: '/',
    version: 'unknown',
    payload: {
      category: 'feedback',
      description: 'Test feedback',
    },
    user: {
      user_id: 'user-123',
      email: 'reporter@example.com',
    },
    ...overrides,
  } as Event;
}

export function createMockComment(overrides: Partial<IssueComment> = {}): IssueComment {
  return {
    comment_id: nextId(),
    issue_id: 'issue-001',
    author_email: 'admin@test.com',
    author_name: 'Admin User',
    body: 'Test comment body',
    source: 'console',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ============ Express Mock Helpers ============

export interface MockUser {
  user_id: string;
  email: string;
  name?: string;
  role: 'Admin' | 'PO' | 'Engineer' | 'ReadOnly';
  app_access: string[];
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    user_id: nextId(),
    email: 'user@test.com',
    name: 'Test User',
    role: 'Admin',
    app_access: ['app-001'],
    ...overrides,
  };
}

export function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    headers: {},
    auth: {
      type: 'oauth',
      user: createMockUser(),
    },
    requestId: 'req-test-001',
    startTime: Date.now(),
    ...overrides,
  };
}

export function createMockResponse() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

export function createMockNext() {
  return vi.fn();
}
