/**
 * Firestore Service
 * Database operations for BritePulse entities
 */

import admin from 'firebase-admin';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import type {
  App,
  Event,
  Issue,
  IssueInput,
  IssueUpdateInput,
  IssueFilters,
  IssueSortOptions,
  AuditLog,
  AuditLogInput,
  User,
  UserInput,
  InstallKeys,
  Attachment,
  IssueComment,
} from '@britepulse/shared';

// Initialize Firebase Admin
let initialized = false;

function initializeFirebase(): void {
  if (initialized) return;

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  console.log('[Firebase] Initializing with:', {
    projectId: config.gcpProjectId,
    keyFilename: keyFile || '(using application default credentials)',
  });

  // Use Application Default Credentials in Cloud Run (no key file needed)
  // Fall back to key file for local development
  if (keyFile) {
    admin.initializeApp({
      credential: admin.credential.cert(keyFile),
      projectId: config.gcpProjectId,
    });
  } else {
    // Cloud Run provides credentials automatically via metadata server
    admin.initializeApp({
      projectId: config.gcpProjectId,
    });
  }

  initialized = true;
  console.log('[Firebase] Initialized successfully');
}

export function getFirestore(): FirebaseFirestore.Firestore {
  initializeFirebase();
  return getAdminFirestore();
}

// Collection names
const COLLECTIONS = {
  apps: 'apps',
  events: 'events',
  issues: 'issues',
  auditLogs: 'audit_logs',
  users: 'users',
  attachments: 'attachments',
} as const;

// ============ App Operations ============

export async function createApp(appData: Omit<App, 'app_id' | 'created_at' | 'updated_at'>): Promise<App> {
  const firestore = getFirestore();
  const appId = uuidv4();
  const now = new Date().toISOString();

  const app: App = {
    ...appData,
    app_id: appId,
    created_at: now,
    updated_at: now,
  };

  await firestore.collection(COLLECTIONS.apps).doc(appId).set(app);
  return app;
}

export async function getApp(appId: string): Promise<App | null> {
  const firestore = getFirestore();
  const doc = await firestore.collection(COLLECTIONS.apps).doc(appId).get();
  if (!doc.exists) return null;
  return doc.data() as App;
}

export async function getApps(appIds?: string[]): Promise<App[]> {
  const firestore = getFirestore();
  let query = firestore.collection(COLLECTIONS.apps);

  // If appIds is provided but empty, user has no access - return empty
  if (appIds !== undefined && appIds !== null && appIds.length === 0) {
    return [];
  }

  if (appIds && appIds.length > 0) {
    // Firestore 'in' query supports max 10 items
    const chunks = [];
    for (let i = 0; i < appIds.length; i += 10) {
      chunks.push(appIds.slice(i, i + 10));
    }

    const results: App[] = [];
    for (const chunk of chunks) {
      const snapshot = await query.where('app_id', 'in', chunk).get();
      results.push(...snapshot.docs.map((doc) => doc.data() as App));
    }
    return results;
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as App);
}

export async function updateApp(appId: string, updates: Partial<App>): Promise<App | null> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.apps).doc(appId);

  const doc = await docRef.get();
  if (!doc.exists) return null;

  const updatedData = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await docRef.update(updatedData);
  return { ...(doc.data() as App), ...updatedData };
}

export async function deleteApp(appId: string): Promise<boolean> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.apps).doc(appId);

  const doc = await docRef.get();
  if (!doc.exists) return false;

  await docRef.delete();
  return true;
}

// ============ Install Keys Operations ============

export async function getInstallKeys(appId: string, environment: string): Promise<InstallKeys | null> {
  const firestore = getFirestore();
  const doc = await firestore
    .collection(COLLECTIONS.apps)
    .doc(appId)
    .collection('install_keys')
    .doc(environment)
    .get();

  if (!doc.exists) return null;
  return doc.data() as InstallKeys;
}

export async function createInstallKeys(appId: string, environment: string): Promise<InstallKeys> {
  const firestore = getFirestore();

  const keys: InstallKeys = {
    public_key: `pk_${appId}_${uuidv4().replace(/-/g, '')}`,
    server_key: `sk_${appId}_${uuidv4().replace(/-/g, '')}`,
    key_rotated_at: new Date().toISOString(),
  };

  await firestore
    .collection(COLLECTIONS.apps)
    .doc(appId)
    .collection('install_keys')
    .doc(environment)
    .set(keys);

  return keys;
}

export async function rotateInstallKeys(
  appId: string,
  environment: string,
  keyType: 'public' | 'server' | 'both'
): Promise<InstallKeys> {
  const firestore = getFirestore();
  const docRef = firestore
    .collection(COLLECTIONS.apps)
    .doc(appId)
    .collection('install_keys')
    .doc(environment);

  const doc = await docRef.get();
  const existing = doc.exists ? (doc.data() as InstallKeys) : null;

  const keys: InstallKeys = {
    public_key:
      keyType === 'public' || keyType === 'both'
        ? `pk_${appId}_${uuidv4().replace(/-/g, '')}`
        : existing?.public_key || `pk_${appId}_${uuidv4().replace(/-/g, '')}`,
    server_key:
      keyType === 'server' || keyType === 'both'
        ? `sk_${appId}_${uuidv4().replace(/-/g, '')}`
        : existing?.server_key || `sk_${appId}_${uuidv4().replace(/-/g, '')}`,
    key_rotated_at: new Date().toISOString(),
  };

  await docRef.set(keys);
  return keys;
}

// ============ Event Operations ============

export async function createEvent(eventData: Omit<Event, 'event_id'>): Promise<Event> {
  const firestore = getFirestore();
  const eventId = uuidv4();

  const event: Event = {
    ...eventData,
    event_id: eventId,
  };

  await firestore.collection(COLLECTIONS.events).doc(eventId).set(event);
  return event;
}

export async function getEvent(eventId: string): Promise<Event | null> {
  const firestore = getFirestore();
  const doc = await firestore.collection(COLLECTIONS.events).doc(eventId).get();
  if (!doc.exists) return null;
  return doc.data() as Event;
}

export async function updateEvent(
  eventId: string,
  updates: Partial<Pick<Event, 'attachment_refs'>>
): Promise<Event | null> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.events).doc(eventId);
  const doc = await docRef.get();
  if (!doc.exists) return null;

  await docRef.update(updates);
  const updated = await docRef.get();
  return updated.data() as Event;
}

export async function getEventsByIssue(issueId: string, limit = 100): Promise<Event[]> {
  const firestore = getFirestore();
  // First get the issue to get event_refs
  const issue = await getIssue(issueId);
  if (!issue || !issue.event_refs.length) return [];

  // Fetch events in chunks
  const events: Event[] = [];
  const chunks = [];
  for (let i = 0; i < issue.event_refs.length; i += 10) {
    chunks.push(issue.event_refs.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const snapshot = await firestore
      .collection(COLLECTIONS.events)
      .where('event_id', 'in', chunk)
      .limit(limit - events.length)
      .get();
    events.push(...snapshot.docs.map((doc) => doc.data() as Event));
    if (events.length >= limit) break;
  }

  return events;
}

// ============ Issue Operations ============

export async function createIssue(input: IssueInput): Promise<Issue> {
  const firestore = getFirestore();
  const issueId = uuidv4();
  const now = new Date().toISOString();

  const issue: Issue = {
    issue_id: issueId,
    app_id: input.app_id,
    environment: input.environment,
    status: 'new',
    severity: input.severity || 'P2',
    title: input.title,
    description: input.description,
    issue_type: input.issue_type,
    primary_fingerprint: input.primary_fingerprint || null,
    event_refs: [input.initial_event_id],
    counts: {
      occurrences_total: 1,
      occurrences_24h: 1,
      unique_users_24h_est: 1,
    },
    timestamps: {
      created_at: now,
      last_seen_at: now,
    },
    reported_by: input.reported_by || null,
    ...(input.routing && { routing: input.routing }),
    tags: input.tags || [],
  };

  await firestore.collection(COLLECTIONS.issues).doc(issueId).set(issue);
  return issue;
}

export async function getIssue(issueId: string): Promise<Issue | null> {
  const firestore = getFirestore();
  const doc = await firestore.collection(COLLECTIONS.issues).doc(issueId).get();
  if (!doc.exists) return null;
  return doc.data() as Issue;
}

export async function updateIssue(
  issueId: string,
  updates: IssueUpdateInput
): Promise<Issue | null> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.issues).doc(issueId);

  const doc = await docRef.get();
  if (!doc.exists) return null;

  const { reason, assigned_to, resolution_note, ...updateFields } = updates;
  const now = new Date().toISOString();

  // Build the update object
  const updateData: Record<string, unknown> = {
    ...updateFields,
    'timestamps.last_seen_at': now,
  };

  // Store assigned_to under routing.assigned_to (not top-level)
  if (assigned_to !== undefined) {
    updateData['routing.assigned_to'] = assigned_to;
  }

  // Store resolution note directly on the issue
  if (resolution_note !== undefined) {
    updateData['resolution_note'] = resolution_note;
  }

  // Set resolved_at when status changes to resolved
  if (updates.status === 'resolved') {
    updateData['timestamps.resolved_at'] = now;
  }

  // Set wont_fix_at when status changes to wont_fix
  if (updates.status === 'wont_fix') {
    updateData['timestamps.wont_fix_at'] = now;
  }

  await docRef.update(updateData);

  const updated = await docRef.get();
  return updated.data() as Issue;
}

export async function addEventToIssue(issueId: string, eventId: string): Promise<void> {
  const firestore = getFirestore();
  await firestore
    .collection(COLLECTIONS.issues)
    .doc(issueId)
    .update({
      event_refs: FieldValue.arrayUnion(eventId),
      'counts.occurrences_total': FieldValue.increment(1),
      'counts.occurrences_24h': FieldValue.increment(1),
      'timestamps.last_seen_at': new Date().toISOString(),
    });
}

export async function getIssues(
  filters: IssueFilters,
  sort: IssueSortOptions = { field: 'priority_score', direction: 'desc' },
  page = 1,
  pageSize = 20,
  accessibleAppIds?: string[] | null
): Promise<{ issues: Issue[]; total: number }> {
  const firestore = getFirestore();

  // If accessibleAppIds is provided but empty, user has no access - return empty
  if (accessibleAppIds !== undefined && accessibleAppIds !== null && accessibleAppIds.length === 0) {
    return { issues: [], total: 0 };
  }

  let query: FirebaseFirestore.Query = firestore.collection(COLLECTIONS.issues);

  // Track if we've used an 'in' clause (Firestore only allows one per query)
  let usedInClause = false;

  // Filters that need to be applied in-memory due to Firestore 'in' clause limitation
  const memoryFilters: {
    status?: string[];
    severity?: string[];
    issue_type?: string[];
    app_ids?: string[];
  } = {};

  // Apply app access filter
  if (accessibleAppIds && accessibleAppIds.length > 0) {
    // If user has specific app access and also filtering by app_id, use equality
    if (filters.app_id && accessibleAppIds.includes(filters.app_id)) {
      query = query.where('app_id', '==', filters.app_id);
    } else if (filters.app_id) {
      // User is filtering by an app they don't have access to
      return { issues: [], total: 0 };
    } else if (accessibleAppIds.length === 1) {
      query = query.where('app_id', '==', accessibleAppIds[0]);
    } else if (accessibleAppIds.length <= 10) {
      query = query.where('app_id', 'in', accessibleAppIds);
      usedInClause = true;
    } else {
      // For >10 apps, filter in memory
      memoryFilters.app_ids = accessibleAppIds;
    }
  } else if (filters.app_id) {
    // Admin filtering by specific app
    query = query.where('app_id', '==', filters.app_id);
  }

  // Apply environment filter (always equality, no 'in' needed)
  if (filters.environment) {
    query = query.where('environment', '==', filters.environment);
  }

  // Apply status filter
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      query = query.where('status', '==', statuses[0]);
    } else if (!usedInClause) {
      query = query.where('status', 'in', statuses);
      usedInClause = true;
    } else {
      // Need to filter in memory
      memoryFilters.status = statuses;
    }
  }

  // Apply severity filter
  if (filters.severity) {
    const severities = Array.isArray(filters.severity) ? filters.severity : [filters.severity];
    if (severities.length === 1) {
      query = query.where('severity', '==', severities[0]);
    } else if (!usedInClause) {
      query = query.where('severity', 'in', severities);
      usedInClause = true;
    } else {
      // Need to filter in memory
      memoryFilters.severity = severities;
    }
  }

  // Apply issue_type filter
  if (filters.issue_type) {
    const types = Array.isArray(filters.issue_type) ? filters.issue_type : [filters.issue_type];
    if (types.length === 1) {
      query = query.where('issue_type', '==', types[0]);
    } else if (!usedInClause) {
      query = query.where('issue_type', 'in', types);
      usedInClause = true;
    } else {
      // Need to filter in memory
      memoryFilters.issue_type = types;
    }
  }

  // Apply assigned_to filter (always equality)
  if (filters.assigned_to) {
    query = query.where('routing.assigned_to', '==', filters.assigned_to);
  }

  // Determine sort field
  const sortField =
    sort.field === 'priority_score'
      ? 'severity' // Use severity as proxy for priority
      : sort.field === 'occurrences_24h'
        ? 'counts.occurrences_24h'
        : sort.field === 'unique_users_24h_est'
          ? 'counts.unique_users_24h_est'
          : sort.field === 'last_seen_at'
            ? 'timestamps.last_seen_at'
            : sort.field === 'created_at'
              ? 'timestamps.created_at'
              : sort.field;

  // Check if we need memory filtering
  // Also use memory filtering when 'in' clause is used, because Firestore requires
  // composite indexes for 'in' + orderBy combinations that we may not have
  const needsMemoryFilter = Object.keys(memoryFilters).length > 0 || usedInClause;

  if (needsMemoryFilter) {
    // Fetch all matching docs and filter/sort in memory
    // Don't use orderBy with 'in' clause to avoid missing index errors
    const snapshot = await query.get();
    let allIssues = snapshot.docs.map((doc) => doc.data() as Issue);

    // Apply memory filters
    if (memoryFilters.app_ids) {
      allIssues = allIssues.filter((i) => memoryFilters.app_ids!.includes(i.app_id));
    }
    if (memoryFilters.status) {
      allIssues = allIssues.filter((i) => memoryFilters.status!.includes(i.status));
    }
    if (memoryFilters.severity) {
      allIssues = allIssues.filter((i) => memoryFilters.severity!.includes(i.severity));
    }
    if (memoryFilters.issue_type) {
      allIssues = allIssues.filter((i) => memoryFilters.issue_type!.includes(i.issue_type));
    }

    // Sort in memory
    allIssues.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortField) {
        case 'severity':
          // P0 < P1 < P2 < P3 for ascending
          aVal = ['P0', 'P1', 'P2', 'P3'].indexOf(a.severity);
          bVal = ['P0', 'P1', 'P2', 'P3'].indexOf(b.severity);
          break;
        case 'counts.occurrences_24h':
          aVal = a.counts.occurrences_24h;
          bVal = b.counts.occurrences_24h;
          break;
        case 'counts.unique_users_24h_est':
          aVal = a.counts.unique_users_24h_est;
          bVal = b.counts.unique_users_24h_est;
          break;
        case 'timestamps.last_seen_at':
          aVal = new Date(a.timestamps.last_seen_at).getTime();
          bVal = new Date(b.timestamps.last_seen_at).getTime();
          break;
        case 'timestamps.created_at':
          aVal = new Date(a.timestamps.created_at).getTime();
          bVal = new Date(b.timestamps.created_at).getTime();
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      return sort.direction === 'asc' ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) : aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    });

    const total = allIssues.length;
    const start = (page - 1) * pageSize;
    const issues = allIssues.slice(start, start + pageSize);

    return { issues, total };
  }

  // No memory filtering needed - use Firestore pagination
  // Get total count
  const countSnapshot = await query.get();
  const total = countSnapshot.size;

  // Apply sorting and pagination
  query = query.orderBy(sortField, sort.direction);
  query = query.offset((page - 1) * pageSize).limit(pageSize);

  const snapshot = await query.get();
  const issues = snapshot.docs.map((doc) => doc.data() as Issue);

  return { issues, total };
}

export async function findIssueByFingerprint(
  appId: string,
  environment: string,
  fingerprint: string
): Promise<Issue | null> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(COLLECTIONS.issues)
    .where('app_id', '==', appId)
    .where('environment', '==', environment)
    .where('primary_fingerprint', '==', fingerprint)
    .where('status', 'not-in', ['resolved'])
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Issue;
}

/**
 * Merge source issues into a target issue
 * - Combines event_refs from all source issues into target
 * - Aggregates counts
 * - Marks source issues as resolved with merge reason
 * - Returns updated target issue
 */
export async function mergeIssues(
  targetIssueId: string,
  sourceIssueIds: string[]
): Promise<Issue | null> {
  const firestore = getFirestore();
  const batch = firestore.batch();

  // Get target issue
  const targetDoc = await firestore.collection(COLLECTIONS.issues).doc(targetIssueId).get();
  if (!targetDoc.exists) return null;
  const targetIssue = targetDoc.data() as Issue;

  // Get source issues
  const sourceIssues: Issue[] = [];
  for (const sourceId of sourceIssueIds) {
    const sourceDoc = await firestore.collection(COLLECTIONS.issues).doc(sourceId).get();
    if (sourceDoc.exists) {
      sourceIssues.push(sourceDoc.data() as Issue);
    }
  }

  if (sourceIssues.length === 0) {
    return targetIssue;
  }

  // Aggregate event_refs and counts from source issues
  const allEventRefs = new Set(targetIssue.event_refs);
  let additionalOccurrences = 0;
  let additionalUsers = 0;

  for (const source of sourceIssues) {
    source.event_refs.forEach((ref) => allEventRefs.add(ref));
    additionalOccurrences += source.counts.occurrences_total;
    additionalUsers += source.counts.unique_users_24h_est;
  }

  // Update target issue with merged data
  const targetRef = firestore.collection(COLLECTIONS.issues).doc(targetIssueId);
  batch.update(targetRef, {
    event_refs: Array.from(allEventRefs),
    'counts.occurrences_total': FieldValue.increment(additionalOccurrences),
    'counts.occurrences_24h': FieldValue.increment(
      sourceIssues.reduce((sum, s) => sum + s.counts.occurrences_24h, 0)
    ),
    'timestamps.last_seen_at': new Date().toISOString(),
  });

  // Mark source issues as resolved (merged)
  const now = new Date().toISOString();
  for (const source of sourceIssues) {
    const sourceRef = firestore.collection(COLLECTIONS.issues).doc(source.issue_id);
    batch.update(sourceRef, {
      status: 'resolved',
      'timestamps.resolved_at': now,
      merged_into: targetIssueId,
    });
  }

  await batch.commit();

  // Return updated target issue
  const updatedDoc = await targetRef.get();
  return updatedDoc.data() as Issue;
}

// ============ Comment Operations ============

export async function createComment(
  issueId: string,
  comment: Omit<IssueComment, 'comment_id' | 'created_at'>
): Promise<IssueComment> {
  const firestore = getFirestore();
  const commentId = uuidv4();
  const now = new Date().toISOString();

  const commentDoc: IssueComment = {
    ...comment,
    comment_id: commentId,
    created_at: now,
  };

  await firestore
    .collection(COLLECTIONS.issues)
    .doc(issueId)
    .collection('comments')
    .doc(commentId)
    .set(commentDoc);

  return commentDoc;
}

export async function getComments(issueId: string): Promise<IssueComment[]> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(COLLECTIONS.issues)
    .doc(issueId)
    .collection('comments')
    .orderBy('created_at', 'asc')
    .get();

  return snapshot.docs.map((doc) => doc.data() as IssueComment);
}

// ============ Audit Log Operations ============

export async function createAuditLog(input: AuditLogInput): Promise<AuditLog> {
  const firestore = getFirestore();
  const auditId = uuidv4();
  const now = new Date().toISOString();

  const auditLog: AuditLog = {
    ...input,
    audit_id: auditId,
    timestamp: now,
    metadata: input.metadata || {},
  };

  await firestore.collection(COLLECTIONS.auditLogs).doc(auditId).set(auditLog);
  return auditLog;
}

export async function getAuditLogs(
  filters: {
    actor_id?: string;
    target_type?: string;
    target_id?: string;
    after?: string;
    before?: string;
  },
  page = 1,
  pageSize = 50
): Promise<{ logs: AuditLog[]; total: number }> {
  const firestore = getFirestore();
  let query: FirebaseFirestore.Query = firestore.collection(COLLECTIONS.auditLogs);

  if (filters.actor_id) {
    query = query.where('actor_id', '==', filters.actor_id);
  }
  if (filters.target_type) {
    query = query.where('target_type', '==', filters.target_type);
  }
  if (filters.target_id) {
    query = query.where('target_id', '==', filters.target_id);
  }
  if (filters.after) {
    query = query.where('timestamp', '>=', filters.after);
  }
  if (filters.before) {
    query = query.where('timestamp', '<=', filters.before);
  }

  query = query.orderBy('timestamp', 'desc');

  const countSnapshot = await query.get();
  const total = countSnapshot.size;

  query = query.offset((page - 1) * pageSize).limit(pageSize);

  const snapshot = await query.get();
  const logs = snapshot.docs.map((doc) => doc.data() as AuditLog);

  return { logs, total };
}

// ============ User Operations ============

export async function createUser(input: UserInput): Promise<User> {
  const firestore = getFirestore();
  const userId = uuidv4();
  const now = new Date().toISOString();

  const user: User = {
    ...input,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };

  await firestore.collection(COLLECTIONS.users).doc(userId).set(user);
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(COLLECTIONS.users)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as User;
}

export async function getUser(userId: string): Promise<User | null> {
  const firestore = getFirestore();
  const doc = await firestore.collection(COLLECTIONS.users).doc(userId).get();
  if (!doc.exists) return null;
  return doc.data() as User;
}

export async function updateUser(userId: string, updates: Partial<UserInput>): Promise<User | null> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.users).doc(userId);

  const doc = await docRef.get();
  if (!doc.exists) return null;

  await docRef.update({
    ...updates,
    updated_at: new Date().toISOString(),
  });

  const updated = await docRef.get();
  return updated.data() as User;
}

export async function getAllUsers(): Promise<User[]> {
  const firestore = getFirestore();
  const snapshot = await firestore.collection(COLLECTIONS.users).orderBy('email').get();
  return snapshot.docs.map((doc) => doc.data() as User);
}

export async function deleteUser(userId: string): Promise<boolean> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.users).doc(userId);

  const doc = await docRef.get();
  if (!doc.exists) return false;

  await docRef.delete();
  return true;
}

// ============ Validation Helpers ============

export async function validateApiKey(
  apiKey: string,
  keyType: 'public' | 'server'
): Promise<{ valid: boolean; appId?: string; environment?: string }> {
  // Parse key format: pk_<appId>_<random> or sk_<appId>_<random>
  const prefix = keyType === 'public' ? 'pk_' : 'sk_';
  if (!apiKey.startsWith(prefix)) {
    return { valid: false };
  }

  const parts = apiKey.slice(3).split('_');
  if (parts.length < 2) {
    return { valid: false };
  }

  const appId = parts[0];
  const app = await getApp(appId);
  if (!app) {
    return { valid: false };
  }

  // Check if key matches any environment
  for (const env of app.environments) {
    const keys = await getInstallKeys(appId, env.env_name);
    if (keys) {
      const keyToCheck = keyType === 'public' ? keys.public_key : keys.server_key;
      if (keyToCheck === apiKey) {
        return { valid: true, appId, environment: env.env_name };
      }
    }
  }

  return { valid: false };
}

// ============ Attachment Operations ============

export async function createAttachment(attachment: Attachment): Promise<Attachment> {
  const firestore = getFirestore();
  await firestore.collection(COLLECTIONS.attachments).doc(attachment.attachment_id).set(attachment);
  return attachment;
}

export async function getAttachment(attachmentId: string): Promise<Attachment | null> {
  const firestore = getFirestore();
  const doc = await firestore.collection(COLLECTIONS.attachments).doc(attachmentId).get();
  if (!doc.exists) return null;
  return doc.data() as Attachment;
}

export async function getAttachmentsByEventId(eventId: string): Promise<Attachment[]> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(COLLECTIONS.attachments)
    .where('event_id', '==', eventId)
    .get();
  return snapshot.docs.map((doc) => doc.data() as Attachment);
}

export async function getAttachmentsByEventIds(eventIds: string[]): Promise<Attachment[]> {
  if (eventIds.length === 0) return [];

  const firestore = getFirestore();
  const attachments: Attachment[] = [];

  // Firestore 'in' queries are limited to 10 items
  const chunks = [];
  for (let i = 0; i < eventIds.length; i += 10) {
    chunks.push(eventIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const snapshot = await firestore
      .collection(COLLECTIONS.attachments)
      .where('event_id', 'in', chunk)
      .get();
    attachments.push(...snapshot.docs.map((doc) => doc.data() as Attachment));
  }

  return attachments;
}

export async function deleteAttachment(attachmentId: string): Promise<boolean> {
  const firestore = getFirestore();
  const docRef = firestore.collection(COLLECTIONS.attachments).doc(attachmentId);
  const doc = await docRef.get();
  if (!doc.exists) return false;
  await docRef.delete();
  return true;
}

export async function deleteAttachmentsByEventId(eventId: string): Promise<number> {
  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(COLLECTIONS.attachments)
    .where('event_id', '==', eventId)
    .get();

  if (snapshot.empty) return 0;

  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  return snapshot.docs.length;
}
