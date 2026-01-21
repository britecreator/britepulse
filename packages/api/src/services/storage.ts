/**
 * Google Cloud Storage service for attachment handling
 */

import { Storage } from '@google-cloud/storage';
import { config } from '../config.js';

let storage: Storage | null = null;

/**
 * Get or initialize the GCS client
 */
function getStorage(): Storage {
  if (!storage) {
    storage = new Storage({
      projectId: config.gcpProjectId || undefined,
    });
  }
  return storage;
}

/**
 * Check if storage is configured
 */
export function isStorageConfigured(): boolean {
  return Boolean(config.gcsBucket);
}

/**
 * Allowed content types for attachments
 */
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Validate attachment content type
 */
export function isValidContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.includes(contentType);
}

/**
 * Validate attachment size (base64 string)
 * Base64 encoding increases size by ~33%, so we account for that
 */
export function isValidSize(base64Data: string): boolean {
  // Remove data URL prefix if present
  const data = base64Data.replace(/^data:[^;]+;base64,/, '');
  // Base64 string length * 0.75 = approximate bytes
  const sizeBytes = (data.length * 3) / 4;
  const maxBytes = config.attachmentMaxSizeMb * 1024 * 1024;
  return sizeBytes <= maxBytes;
}

/**
 * Generate storage path for an attachment
 */
export function generateStoragePath(
  appId: string,
  eventId: string,
  attachmentId: string,
  filename: string
): string {
  // Extract extension from filename
  const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
  return `attachments/${appId}/${eventId}/${attachmentId}.${ext}`;
}

/**
 * Upload an attachment to GCS
 * @param storagePath - The path in the bucket
 * @param base64Data - Base64 encoded file data (may include data URL prefix)
 * @param contentType - MIME type of the file
 * @returns The storage path on success
 */
export async function uploadAttachment(
  storagePath: string,
  base64Data: string,
  contentType: string
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error('GCS bucket not configured');
  }

  if (!isValidContentType(contentType)) {
    throw new Error(`Invalid content type: ${contentType}. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
  }

  if (!isValidSize(base64Data)) {
    throw new Error(`Attachment exceeds maximum size of ${config.attachmentMaxSizeMb}MB`);
  }

  // Remove data URL prefix if present
  const data = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(data, 'base64');

  const bucket = getStorage().bucket(config.gcsBucket);
  const file = bucket.file(storagePath);

  await file.save(buffer, {
    contentType,
    metadata: {
      cacheControl: 'private, max-age=3600',
    },
  });

  return storagePath;
}

/**
 * Generate a signed URL for reading an attachment
 * @param storagePath - The path in the bucket
 * @param expiresInMinutes - How long the URL should be valid (default from config)
 * @returns Signed URL for reading the file
 */
export async function generateSignedUrl(
  storagePath: string,
  expiresInMinutes?: number
): Promise<string> {
  if (!isStorageConfigured()) {
    throw new Error('GCS bucket not configured');
  }

  const expiry = expiresInMinutes ?? config.attachmentSignedUrlExpiryMinutes;
  const bucket = getStorage().bucket(config.gcsBucket);
  const file = bucket.file(storagePath);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiry * 60 * 1000,
  });

  return url;
}

/**
 * Delete an attachment from GCS
 * @param storagePath - The path in the bucket
 */
export async function deleteAttachment(storagePath: string): Promise<void> {
  if (!isStorageConfigured()) {
    throw new Error('GCS bucket not configured');
  }

  const bucket = getStorage().bucket(config.gcsBucket);
  const file = bucket.file(storagePath);

  try {
    await file.delete();
  } catch (error: any) {
    // Ignore 404 errors (file already deleted)
    if (error.code !== 404) {
      throw error;
    }
  }
}

/**
 * Check if an attachment exists in GCS
 * @param storagePath - The path in the bucket
 */
export async function attachmentExists(storagePath: string): Promise<boolean> {
  if (!isStorageConfigured()) {
    return false;
  }

  const bucket = getStorage().bucket(config.gcsBucket);
  const file = bucket.file(storagePath);

  const [exists] = await file.exists();
  return exists;
}

/**
 * Calculate expiration date for an attachment
 */
export function calculateExpiresAt(): string {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.attachmentRetentionDays);
  return expiresAt.toISOString();
}
