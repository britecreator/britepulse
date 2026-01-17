/**
 * Redaction Service
 * PII detection and replacement per Build Contract Section 3.2
 */

import type { RedactionProfile } from '@britepulse/shared';

/**
 * Redaction patterns for different PII types
 */
const REDACTION_PATTERNS = {
  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Phone numbers (US format variations)
  phone: /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,

  // Street addresses (basic pattern)
  address:
    /\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir)[\w\s,]*/gi,

  // API keys, tokens, secrets (pattern-based)
  secret:
    /(api[_-]?key|token|password|secret|credential|bearer|authorization)['":\s]*[=:]\s*['"]?[\w\-\.]{16,}['"]?/gi,

  // Account/policy identifiers (configurable patterns)
  accountId: /\b[A-Z]{2,4}[-_]?\d{6,12}\b/g,

  // Social Security Numbers (US)
  ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,

  // Credit card numbers (basic)
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,

  // IP addresses
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
} as const;

/**
 * Redaction replacement tokens
 */
const REDACTION_TOKENS = {
  email: '[REDACTED_EMAIL]',
  phone: '[REDACTED_PHONE]',
  address: '[REDACTED_ADDRESS]',
  secret: '[REDACTED_SECRET]',
  accountId: '[REDACTED_ID]',
  ssn: '[REDACTED_SSN]',
  creditCard: '[REDACTED_CARD]',
  ipAddress: '[REDACTED_IP]',
} as const;

type RedactionType = keyof typeof REDACTION_PATTERNS;

/**
 * Profiles determine which patterns are applied
 */
const PROFILE_PATTERNS: Record<RedactionProfile, RedactionType[]> = {
  strict: ['email', 'phone', 'address', 'secret', 'accountId', 'ssn', 'creditCard', 'ipAddress'],
  standard: ['email', 'phone', 'address', 'secret', 'accountId', 'ssn', 'creditCard'],
  relaxed: ['secret', 'ssn', 'creditCard'],
};

/**
 * Redaction result with metadata
 */
export interface RedactionResult {
  text: string;
  redactionsApplied: number;
  redactionTypes: RedactionType[];
}

/**
 * Apply redaction to a string
 */
export function redactString(
  text: string,
  profile: RedactionProfile = 'standard'
): RedactionResult {
  if (!text || typeof text !== 'string') {
    return {
      text: text || '',
      redactionsApplied: 0,
      redactionTypes: [],
    };
  }

  let result = text;
  let totalRedactions = 0;
  const typesApplied: RedactionType[] = [];

  const patternsToApply = PROFILE_PATTERNS[profile];

  for (const type of patternsToApply) {
    const pattern = REDACTION_PATTERNS[type];
    const token = REDACTION_TOKENS[type];

    // Count matches before replacing
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      totalRedactions += matches.length;
      typesApplied.push(type);
      result = result.replace(pattern, token);
    }
  }

  return {
    text: result,
    redactionsApplied: totalRedactions,
    redactionTypes: typesApplied,
  };
}

/**
 * Apply redaction to an object recursively
 */
export function redactObject<T extends Record<string, unknown>>(
  obj: T,
  profile: RedactionProfile = 'standard',
  maxDepth = 10
): { data: T; redactionsApplied: number } {
  if (maxDepth <= 0) {
    return { data: obj, redactionsApplied: 0 };
  }

  let totalRedactions = 0;

  function processValue(value: unknown, depth: number): unknown {
    if (depth <= 0) return value;

    if (typeof value === 'string') {
      const result = redactString(value, profile);
      totalRedactions += result.redactionsApplied;
      return result.text;
    }

    if (Array.isArray(value)) {
      return value.map((item) => processValue(item, depth - 1));
    }

    if (value !== null && typeof value === 'object') {
      const processed: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        processed[key] = processValue(val, depth - 1);
      }
      return processed;
    }

    return value;
  }

  const data = processValue(obj, maxDepth) as T;
  return { data, redactionsApplied: totalRedactions };
}

/**
 * Check if a string contains any PII
 */
export function containsPII(text: string, profile: RedactionProfile = 'standard'): boolean {
  if (!text || typeof text !== 'string') return false;

  const patternsToCheck = PROFILE_PATTERNS[profile];

  for (const type of patternsToCheck) {
    const pattern = REDACTION_PATTERNS[type];
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Identify PII types present in text
 */
export function identifyPII(
  text: string,
  profile: RedactionProfile = 'standard'
): RedactionType[] {
  if (!text || typeof text !== 'string') return [];

  const found: RedactionType[] = [];
  const patternsToCheck = PROFILE_PATTERNS[profile];

  for (const type of patternsToCheck) {
    const pattern = new RegExp(REDACTION_PATTERNS[type].source, REDACTION_PATTERNS[type].flags);
    if (pattern.test(text)) {
      found.push(type);
    }
  }

  return found;
}

/**
 * Validate that content is safe for AI (no secrets, no PII)
 */
export function validateForAI(text: string): {
  safe: boolean;
  violations: RedactionType[];
} {
  const violations: RedactionType[] = [];

  // Always check for secrets
  if (REDACTION_PATTERNS.secret.test(text)) {
    violations.push('secret');
  }

  // Check for unredacted PII
  const piiTypes: RedactionType[] = ['email', 'phone', 'ssn', 'creditCard'];
  for (const type of piiTypes) {
    const pattern = new RegExp(REDACTION_PATTERNS[type].source, REDACTION_PATTERNS[type].flags);
    if (pattern.test(text)) {
      violations.push(type);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
