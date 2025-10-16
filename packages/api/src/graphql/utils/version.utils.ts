import { promisify } from 'util';
import * as zlib from 'zlib';

// Promisify zlib functions for async/await usage
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Maximum payload size (10MB) to prevent memory exhaustion and DoS attacks
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

/**
 * Interface representing the differences between two versions
 */
export interface VersionDiff {
  /** Fields that were added in the new version */
  added: Record<string, unknown>;
  /** Fields that were modified (with old and new values) */
  modified: Record<string, { old: unknown; new: unknown }>;
  /** Fields that were removed in the new version */
  removed: Record<string, unknown>;
}

/**
 * Compresses a payload object using gzip compression
 * @param payload - The object to compress
 * @returns Promise resolving to compressed Buffer
 * @throws Error if payload is too large or cannot be serialized
 */
export async function compressPayload(payload: Record<string, unknown>): Promise<Buffer> {
  try {
    const jsonString = JSON.stringify(payload);

    // Check size before compression to prevent excessive memory usage
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf-8');
    if (sizeInBytes > MAX_PAYLOAD_SIZE) {
      throw new Error(`Payload too large: ${sizeInBytes} bytes (max: ${MAX_PAYLOAD_SIZE})`);
    }

    return gzip(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to compress payload: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decompresses a gzip-compressed Buffer back to an object
 * @param compressed - The compressed Buffer
 * @returns Promise resolving to the original object
 * @throws Error if input is invalid, corrupted, or decompresses to an excessively large payload
 */
export async function decompressPayload(compressed: Buffer): Promise<Record<string, unknown>> {
  if (!Buffer.isBuffer(compressed)) {
    throw new Error('Invalid input: expected Buffer');
  }

  try {
    const decompressed = await gunzip(compressed);

    // Check decompressed size to prevent decompression bomb attacks
    if (decompressed.length > MAX_PAYLOAD_SIZE) {
      throw new Error(
        `Decompressed payload too large: ${decompressed.length} bytes (max: ${MAX_PAYLOAD_SIZE})`
      );
    }

    return JSON.parse(decompressed.toString('utf-8'));
  } catch (error) {
    throw new Error(
      `Failed to decompress payload: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculates the differences between two payload objects
 * @param oldPayload - The previous version's payload
 * @param newPayload - The new version's payload
 * @returns VersionDiff object containing added, modified, and removed fields
 */
export function calculateDiff(
  oldPayload: Record<string, unknown>,
  newPayload: Record<string, unknown>
): VersionDiff {
  return {
    added: getAddedFields(oldPayload, newPayload),
    modified: getModifiedFields(oldPayload, newPayload),
    removed: getRemovedFields(oldPayload, newPayload),
  };
}

/**
 * Gets fields that were added in the new payload
 */
function getAddedFields(
  oldPayload: Record<string, unknown>,
  newPayload: Record<string, unknown>
): Record<string, unknown> {
  const added: Record<string, unknown> = {};
  const oldKeys = new Set(Object.keys(oldPayload));

  for (const [key, value] of Object.entries(newPayload)) {
    if (!oldKeys.has(key)) {
      added[key] = value;
    }
  }

  return added;
}

/**
 * Gets fields that were modified between old and new payloads
 */
function getModifiedFields(
  oldPayload: Record<string, unknown>,
  newPayload: Record<string, unknown>
): Record<string, { old: unknown; new: unknown }> {
  const modified: Record<string, { old: unknown; new: unknown }> = {};
  const oldEntries = Object.entries(oldPayload);

  for (const [key, oldValue] of oldEntries) {
    if (key in newPayload) {
      const newValue = newPayload[key];
      if (!deepEqual(oldValue, newValue)) {
        modified[key] = { old: oldValue, new: newValue };
      }
    }
  }

  return modified;
}

/**
 * Gets fields that were removed in the new payload
 */
function getRemovedFields(
  oldPayload: Record<string, unknown>,
  newPayload: Record<string, unknown>
): Record<string, unknown> {
  const removed: Record<string, unknown> = {};
  const newKeys = new Set(Object.keys(newPayload));

  for (const [key, value] of Object.entries(oldPayload)) {
    if (!newKeys.has(key)) {
      removed[key] = value;
    }
  }

  return removed;
}

/**
 * Deep equality check for comparing values with depth limit protection
 * @param a - First value to compare
 * @param b - Second value to compare
 * @param maxDepth - Maximum recursion depth (default: 50)
 * @param currentDepth - Current recursion depth (internal use)
 * @returns true if values are deeply equal
 */
function deepEqual(a: unknown, b: unknown, maxDepth = 50, currentDepth = 0): boolean {
  // Handle primitives and null/undefined
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a !== typeof b) return false;

  // Check depth limit to prevent stack overflow
  if (currentDepth > maxDepth) {
    throw new Error('Object nesting too deep for comparison');
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index], maxDepth, currentDepth + 1));
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);

    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        maxDepth,
        currentDepth + 1
      )
    );
  }

  return false;
}
