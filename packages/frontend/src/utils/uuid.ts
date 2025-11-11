/**
 * UUID Generation Utility
 *
 * Provides a cross-browser compatible UUID generation function that gracefully
 * falls back when crypto.randomUUID() is unavailable.
 *
 * Usage:
 * ```typescript
 * import { generateUUID } from '@/utils/uuid';
 *
 * const id = generateUUID(); // Uses crypto.randomUUID() if available
 * ```
 */

/**
 * Generate a universally unique identifier (UUID)
 *
 * Uses the native crypto.randomUUID() API when available (modern browsers with secure context).
 * Falls back to a compatible alternative using Math.random() for:
 * - Older browsers without Web Crypto API support
 * - Non-secure contexts (HTTP instead of HTTPS)
 * - Test environments where crypto may be mocked or unavailable
 *
 * @returns A unique identifier string
 *
 * @example
 * // In modern browsers (HTTPS or localhost):
 * generateUUID(); // "550e8400-e29b-41d4-a716-446655440000" (RFC 4122 v4 UUID)
 *
 * @example
 * // In older browsers or HTTP contexts:
 * generateUUID(); // "1762881234567-a3k9j2m4n8p" (timestamp + random alphanumeric)
 */
export function generateUUID(): string {
  // Try to use native crypto.randomUUID() if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // crypto.randomUUID() exists but threw an error (e.g., insecure context)
      // Fall through to fallback implementation
      console.warn('crypto.randomUUID() failed, using fallback:', error);
    }
  }

  // Fallback: Generate a pseudo-UUID using timestamp + random alphanumeric
  // Format: timestamp-random (e.g., "1762881234567-a3k9j2m4n8p")
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`;
}

/**
 * Generate a short unique identifier (non-UUID format)
 *
 * Useful for UI component keys or temporary IDs where full UUID format
 * isn't necessary. Shorter and more readable than full UUIDs.
 *
 * @returns A short unique identifier (e.g., "a3k9j2m4n")
 *
 * @example
 * generateShortId(); // "a3k9j2m4n" (9 characters, alphanumeric)
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 11);
}
