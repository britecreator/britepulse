/**
 * Fingerprinting Service
 * Error deduplication per Build Contract Section 7.1
 */

import { createHash } from 'crypto';

/**
 * Error event data for fingerprinting
 */
export interface FingerprintInput {
  error_type: string;
  message: string;
  stack?: string;
  route_or_url?: string;
}

/**
 * Default number of stack frames to use
 */
const DEFAULT_TOP_FRAMES = 5;

/**
 * Normalize error message by removing variable parts
 * - Remove UUIDs
 * - Remove timestamps
 * - Remove numeric IDs
 * - Remove file paths that vary
 */
export function normalizeMessage(message: string): string {
  if (!message) return '';

  let normalized = message;

  // Remove UUIDs
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '<UUID>'
  );

  // Remove timestamps (ISO format)
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/g,
    '<TIMESTAMP>'
  );

  // Remove numeric IDs (6+ digits)
  normalized = normalized.replace(/\b\d{6,}\b/g, '<ID>');

  // Remove hex strings (likely hashes or tokens)
  normalized = normalized.replace(/\b[0-9a-f]{32,}\b/gi, '<HASH>');

  // Remove file paths (keep just filename)
  normalized = normalized.replace(
    /(?:\/[\w.-]+)+\/?([\w.-]+\.[a-z]+)/gi,
    '<PATH>/$1'
  );

  // Remove Windows paths
  normalized = normalized.replace(
    /(?:[A-Z]:\\[\w\\.-]+\\)?([\w.-]+\.[a-z]+)/gi,
    '<PATH>/$1'
  );

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extract and normalize top stack frames
 */
export function extractTopFrames(stack: string, topN: number = DEFAULT_TOP_FRAMES): string {
  if (!stack) return '';

  const lines = stack.split('\n').map((line) => line.trim());

  // Skip the first line if it's the error message
  const frameLines = lines.filter((line) => line.startsWith('at ') || line.match(/^\s*at\s/));

  // Take top N frames
  const topFrames = frameLines.slice(0, topN);

  // Normalize each frame
  const normalized = topFrames.map((frame) => {
    // Remove line/column numbers that vary
    let normalized = frame.replace(/:\d+:\d+\)?$/, ')');

    // Normalize paths
    normalized = normalized.replace(
      /(?:\/[\w.-]+)+\/([\w.-]+\.[a-z]+)/gi,
      '<PATH>/$1'
    );

    // Remove query strings from URLs
    normalized = normalized.replace(/\?[^\s)]+/g, '');

    return normalized;
  });

  return normalized.join('\n');
}

/**
 * Normalize route/URL for grouping
 */
export function normalizeRoute(routeOrUrl: string): string {
  if (!routeOrUrl) return '';

  let normalized = routeOrUrl;

  // Remove query strings
  normalized = normalized.split('?')[0];

  // Remove hash fragments
  normalized = normalized.split('#')[0];

  // Replace numeric segments with placeholder (e.g., /users/123 -> /users/<id>)
  normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/<id>');

  // Replace UUID segments
  normalized = normalized.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
    '/<uuid>'
  );

  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');

  return normalized;
}

/**
 * Generate a stable fingerprint for an error
 * Based on Build Contract Section 7.1
 */
export function generateFingerprint(input: FingerprintInput): string {
  const components: string[] = [];

  // 1. Error type
  components.push(input.error_type || 'UnknownError');

  // 2. Normalized message
  components.push(normalizeMessage(input.message));

  // 3. Top stack frames
  if (input.stack) {
    components.push(extractTopFrames(input.stack));
  }

  // 4. Route group (optional but recommended)
  if (input.route_or_url) {
    components.push(normalizeRoute(input.route_or_url));
  }

  // Join components and hash
  const combined = components.join('::');
  const hash = createHash('sha256').update(combined).digest('hex');

  // Return first 16 chars for readability while maintaining uniqueness
  return hash.substring(0, 16);
}

/**
 * Check if two fingerprints match
 */
export function fingerprintsMatch(fp1: string, fp2: string): boolean {
  return fp1 === fp2;
}

/**
 * Extract fingerprint input from event payload
 */
export function extractFingerprintInput(
  eventType: string,
  payload: Record<string, unknown>,
  routeOrUrl?: string
): FingerprintInput | null {
  // Only fingerprint error events
  if (eventType !== 'frontend_error' && eventType !== 'backend_error') {
    return null;
  }

  const errorType = (payload.error_type as string) || 'UnknownError';
  const message = (payload.message as string) || '';
  const stack = payload.stack as string | undefined;

  return {
    error_type: errorType,
    message,
    stack,
    route_or_url: routeOrUrl,
  };
}

/**
 * Compute similarity score between two fingerprint inputs
 * Returns 0-1 where 1 is identical
 */
export function computeSimilarity(
  input1: FingerprintInput,
  input2: FingerprintInput
): number {
  let score = 0;
  let weights = 0;

  // Error type match (weight: 30%)
  if (input1.error_type === input2.error_type) {
    score += 0.3;
  }
  weights += 0.3;

  // Message similarity (weight: 40%)
  const norm1 = normalizeMessage(input1.message);
  const norm2 = normalizeMessage(input2.message);
  if (norm1 === norm2) {
    score += 0.4;
  } else if (norm1 && norm2) {
    // Partial match using Jaccard similarity of words
    const words1 = new Set(norm1.toLowerCase().split(/\s+/));
    const words2 = new Set(norm2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    const jaccard = intersection.size / union.size;
    score += 0.4 * jaccard;
  }
  weights += 0.4;

  // Stack similarity (weight: 20%)
  if (input1.stack && input2.stack) {
    const frames1 = extractTopFrames(input1.stack);
    const frames2 = extractTopFrames(input2.stack);
    if (frames1 === frames2) {
      score += 0.2;
    }
  }
  weights += 0.2;

  // Route similarity (weight: 10%)
  if (input1.route_or_url && input2.route_or_url) {
    const route1 = normalizeRoute(input1.route_or_url);
    const route2 = normalizeRoute(input2.route_or_url);
    if (route1 === route2) {
      score += 0.1;
    }
  }
  weights += 0.1;

  return score / weights;
}
