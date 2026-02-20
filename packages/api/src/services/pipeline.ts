/**
 * Event Processing Pipeline
 * Orchestrates event ingestion, redaction, fingerprinting, and issue grouping
 */

import type { Event, Issue, IssueInput, EventType, RedactionProfile, Attachment, Environment } from '@britepulse/shared';
import { v4 as uuidv4 } from 'uuid';
import { redactObject } from './redaction.js';
import { generateFingerprint, extractFingerprintInput } from './fingerprint.js';
import * as firestoreService from './firestore.js';
import * as storageService from './storage.js';
import { config } from '../config.js';

// Lazy load AI triage to avoid startup issues if not configured
let aiTriageInitialized = false;
let aiTriageModule: typeof import('@britepulse/ai-triage') | null = null;

async function initAITriage(): Promise<typeof import('@britepulse/ai-triage') | null> {
  if (aiTriageInitialized) return aiTriageModule;

  aiTriageInitialized = true;

  if (!config.anthropicApiKey) {
    console.log('[Pipeline] AI triage disabled - no ANTHROPIC_API_KEY configured');
    return null;
  }

  try {
    aiTriageModule = await import('@britepulse/ai-triage');
    aiTriageModule.initClient(config.anthropicApiKey);
    console.log('[Pipeline] AI triage initialized');
    return aiTriageModule;
  } catch (error) {
    console.warn('[Pipeline] Failed to initialize AI triage:', error);
    return null;
  }
}

/**
 * Attachment upload input (from SDK)
 */
export interface AttachmentUploadInput {
  filename: string;
  content_type: string;
  data: string; // base64
  user_opted_in: true;
}

/**
 * Pipeline processing result
 */
export interface PipelineResult {
  event: Event;
  issue: Issue;
  isNewIssue: boolean;
  redactionsApplied: number;
  fingerprint: string | null;
  attachmentIds: string[];
}

/**
 * Process an incoming event through the pipeline
 * 1. Apply redaction
 * 2. Generate fingerprint (for errors)
 * 3. Find or create issue
 * 4. Store event and update issue
 * 5. Process attachments (if any)
 */
export async function processEvent(
  eventData: Omit<Event, 'event_id' | 'fingerprint'>,
  redactionProfile: RedactionProfile = 'standard',
  attachments?: AttachmentUploadInput[]
): Promise<PipelineResult> {
  // Step 1: Apply redaction to payload
  const { data: redactedPayload, redactionsApplied } = redactObject(
    eventData.payload as unknown as Record<string, unknown>,
    redactionProfile
  );

  // Step 2: Generate fingerprint for error events
  let fingerprint: string | null = null;
  if (eventData.event_type === 'frontend_error' || eventData.event_type === 'backend_error') {
    const fingerprintInput = extractFingerprintInput(
      eventData.event_type,
      redactedPayload,
      eventData.route_or_url
    );
    if (fingerprintInput) {
      fingerprint = generateFingerprint(fingerprintInput);
    }
  }

  // Step 3: Create event with redacted data
  const eventToCreate: Omit<Event, 'event_id'> = {
    ...eventData,
    payload: redactedPayload as unknown as Event['payload'],
  };
  // Only include fingerprint if it exists (Firestore doesn't allow undefined)
  if (fingerprint) {
    eventToCreate.fingerprint = fingerprint;
  }
  const event = await firestoreService.createEvent(eventToCreate);

  // Step 4: Find or create issue
  let issue: Issue;
  let isNewIssue = false;

  if (fingerprint) {
    // Try to find existing issue with same fingerprint
    const existingIssue = await firestoreService.findIssueByFingerprint(
      event.app_id,
      event.environment,
      fingerprint
    );

    if (existingIssue) {
      // Add event to existing issue
      await firestoreService.addEventToIssue(existingIssue.issue_id, event.event_id);
      issue = (await firestoreService.getIssue(existingIssue.issue_id))!;
    } else {
      // Create new issue
      issue = await createIssueFromEvent(event, fingerprint);
      isNewIssue = true;
    }
  } else {
    // Feedback events - create new issue (or use similarity matching later)
    issue = await createIssueFromEvent(event, null);
    isNewIssue = true;
  }

  // Step 5: Process attachments if any
  const attachmentIds: string[] = [];
  if (attachments && attachments.length > 0 && storageService.isStorageConfigured()) {
    for (const attachment of attachments) {
      try {
        const attachmentId = uuidv4();
        const storagePath = storageService.generateStoragePath(
          event.app_id,
          event.event_id,
          attachmentId,
          attachment.filename
        );

        // Upload to GCS
        await storageService.uploadAttachment(
          storagePath,
          attachment.data,
          attachment.content_type
        );

        // Calculate file size from base64
        const data = attachment.data.replace(/^data:[^;]+;base64,/, '');
        const sizeBytes = Math.floor((data.length * 3) / 4);

        // Create attachment record
        const attachmentRecord: Attachment = {
          attachment_id: attachmentId,
          event_id: event.event_id,
          app_id: event.app_id,
          environment: event.environment as Environment,
          filename: attachment.filename,
          content_type: attachment.content_type,
          size_bytes: sizeBytes,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          expires_at: storageService.calculateExpiresAt(),
          user_opted_in: attachment.user_opted_in,
        };

        await firestoreService.createAttachment(attachmentRecord);
        attachmentIds.push(attachmentId);
      } catch (error) {
        console.error('[Pipeline] Failed to process attachment:', error);
        // Continue processing other attachments
      }
    }

    // Update event with attachment refs if any were successfully processed
    if (attachmentIds.length > 0) {
      await firestoreService.updateEvent(event.event_id, { attachment_refs: attachmentIds });
      event.attachment_refs = attachmentIds;
    }
  }

  // Step 6: Check for AI triage eligibility (async, non-blocking)
  maybeRunAITriage(issue, event).catch((error) => {
    console.error('[Pipeline] AI triage error:', error);
  });

  return {
    event,
    issue,
    isNewIssue,
    redactionsApplied,
    fingerprint,
    attachmentIds,
  };
}

/**
 * Create an issue from an event
 */
async function createIssueFromEvent(
  event: Event,
  fingerprint: string | null
): Promise<Issue> {
  // Extract reporter from event user (only include email if it exists - Firestore rejects undefined)
  const reportedBy =
    event.user?.user_id && event.user.user_id !== 'unknown'
      ? {
          user_id: event.user.user_id,
          ...(event.user.email && { email: event.user.email }),
        }
      : null;

  // Look up the app to auto-assign to the first product owner
  const app = await firestoreService.getApp(event.app_id);
  const firstOwner = app?.owners?.po_emails?.[0];

  const issueInput: IssueInput = {
    app_id: event.app_id,
    environment: event.environment,
    title: generateIssueTitle(event),
    description: generateIssueDescription(event),
    issue_type: mapEventTypeToIssueType(event.event_type),
    severity: inferSeverity(event),
    primary_fingerprint: fingerprint || undefined,
    initial_event_id: event.event_id,
    reported_by: reportedBy,
    ...(firstOwner && { routing: { assigned_to: firstOwner } }),
  };

  return firestoreService.createIssue(issueInput);
}

/**
 * Generate issue title from event
 */
function generateIssueTitle(event: Event): string {
  const payload = event.payload as unknown as Record<string, unknown>;

  if (event.event_type === 'feedback') {
    const category = (payload.category as string) || 'Feedback';
    const description = (payload.description as string) || '';
    // Take first 50 chars of description
    const truncated = description.length > 50 ? description.substring(0, 47) + '...' : description;
    return `${capitalize(category)}: ${truncated}`;
  }

  if (event.event_type === 'frontend_error' || event.event_type === 'backend_error') {
    const errorType = (payload.error_type as string) || 'Error';
    const message = (payload.message as string) || 'Unknown error';
    // Take first 60 chars of message
    const truncated = message.length > 60 ? message.substring(0, 57) + '...' : message;
    return `${errorType}: ${truncated}`;
  }

  return `Event: ${event.event_type}`;
}

/**
 * Generate issue description from event
 */
function generateIssueDescription(event: Event): string {
  const payload = event.payload as unknown as Record<string, unknown>;
  const parts: string[] = [];

  parts.push(`Route: ${event.route_or_url}`);
  parts.push(`Version: ${event.version}`);
  parts.push(`Environment: ${event.environment}`);

  if (event.event_type === 'feedback') {
    parts.push(`\nDescription: ${(payload.description as string) || 'N/A'}`);
    if (payload.reproduction_steps) {
      parts.push(`\nReproduction Steps: ${payload.reproduction_steps}`);
    }
  }

  if (event.event_type === 'frontend_error' || event.event_type === 'backend_error') {
    parts.push(`\nError: ${(payload.message as string) || 'Unknown'}`);
    if (payload.stack) {
      // Truncate stack trace
      const stack = (payload.stack as string).split('\n').slice(0, 10).join('\n');
      parts.push(`\nStack Trace:\n${stack}`);
    }
  }

  return parts.join('\n');
}

/**
 * Map event type to issue type
 */
function mapEventTypeToIssueType(eventType: EventType): 'bug' | 'feature' | 'feedback' | 'question' {
  if (eventType === 'frontend_error' || eventType === 'backend_error') {
    return 'bug';
  }
  return 'feedback';
}

/**
 * Infer severity from event
 */
function inferSeverity(event: Event): 'P0' | 'P1' | 'P2' | 'P3' {
  const payload = event.payload as unknown as Record<string, unknown>;

  // Backend errors in prod start at P1
  if (event.event_type === 'backend_error' && event.environment === 'prod') {
    // Check for specific error types that indicate P0
    const errorType = (payload.error_type as string) || '';
    if (
      errorType.toLowerCase().includes('critical') ||
      errorType.toLowerCase().includes('fatal') ||
      (payload.http_status as number) >= 500
    ) {
      return 'P1';
    }
    return 'P2';
  }

  // Frontend errors start at P2
  if (event.event_type === 'frontend_error') {
    return event.environment === 'prod' ? 'P2' : 'P3';
  }

  // Feedback from users in prod starts at P2
  if (event.event_type === 'feedback') {
    const category = (payload.category as string) || '';
    if (category === 'bug') {
      return event.environment === 'prod' ? 'P2' : 'P3';
    }
    return 'P3';
  }

  return 'P3';
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Batch process multiple events
 */
export async function processBatch(
  events: Array<Omit<Event, 'event_id' | 'fingerprint'>>,
  redactionProfile: RedactionProfile = 'standard'
): Promise<PipelineResult[]> {
  const results: PipelineResult[] = [];

  for (const eventData of events) {
    try {
      const result = await processEvent(eventData, redactionProfile);
      results.push(result);
    } catch (error) {
      console.error('Failed to process event:', error);
      // Continue processing other events
    }
  }

  return results;
}

/**
 * Check if an issue is eligible for AI triage and run it if so
 * This runs asynchronously and doesn't block event ingestion
 */
async function maybeRunAITriage(issue: Issue, event: Event): Promise<void> {
  // Only run for error events (not feedback)
  if (event.event_type !== 'frontend_error' && event.event_type !== 'backend_error') {
    return;
  }

  const aiTriage = await initAITriage();
  if (!aiTriage) return;

  // Check eligibility
  const eligibility = aiTriage.isEligibleForTriage(issue);
  if (!eligibility.eligible) {
    return;
  }

  console.log(`[Pipeline] Issue ${issue.issue_id} eligible for AI triage: running analysis`);

  // Get events for this issue
  const events = await firestoreService.getEventsByIssue(issue.issue_id, 10);

  // Get app name
  const app = await firestoreService.getApp(issue.app_id);
  const appName = app?.name || 'Unknown App';

  // Run triage
  const result = await aiTriage.runTriage(issue, events, appName, {
    force: false,
  });

  if (result.success && result.analysis) {
    // Store analysis on issue
    await firestoreService.updateIssue(issue.issue_id, {
      ai_analysis: result.analysis,
    });
    console.log(`[Pipeline] AI analysis stored for issue ${issue.issue_id}`);
  } else if (result.skipped_reason) {
    console.log(`[Pipeline] AI triage skipped: ${result.skipped_reason}`);
  } else if (result.error) {
    console.error(`[Pipeline] AI triage failed: ${result.error}`);
  }
}
