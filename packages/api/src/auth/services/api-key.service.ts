/**
 * @fileoverview API Key Service - Manages programmatic access credentials
 *
 * This service handles secure generation, validation, and lifecycle management of API keys
 * for programmatic access to the campaign management API.
 *
 * Security features:
 * - Cryptographically secure random key generation (24 bytes entropy)
 * - Bcrypt hashing of keys at rest (never stored in plaintext)
 * - One-time plaintext key display during creation
 * - Automatic expiration and revocation support
 * - Scope-based permission control
 * - Campaign-specific key isolation (optional)
 * - Last-used timestamp tracking
 * - Constant-time comparison for validation (via bcrypt)
 *
 * Key format: camp_sk_<32_base64url_characters>
 * - Prefix identifies key type (campaign secret key)
 * - Base64url encoding for URL-safe transmission
 * - 24 random bytes provides 192 bits of entropy
 *
 * Usage workflow:
 * 1. User creates API key via authenticated session
 * 2. Service returns plaintext key ONCE (user must save it)
 * 3. Hashed key stored in database
 * 4. Client includes key in API requests (Authorization: Bearer camp_sk_...)
 * 5. Service validates key against all active hashed keys
 * 6. Returns associated user and permissions on successful validation
 *
 * @module auth/services/api-key
 */

import * as crypto from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { hashPassword, comparePassword } from '../utils/password.util';

/**
 * Data required to create a new API key
 */
export interface CreateApiKeyData {
  /** ID of the user who owns this API key */
  userId: string;
  /** Human-readable name for the API key (e.g., "Production Server", "CI/CD Pipeline") */
  name: string;
  /** Array of permission scopes (e.g., ["read:campaigns", "write:events"]) */
  scopes: string[];
  /** Optional campaign ID to restrict key access to a specific campaign */
  campaignId?: string;
  /** Optional expiration date; key becomes invalid after this time */
  expiresAt?: Date;
}

/**
 * Service for managing API keys used for programmatic authentication
 *
 * Provides secure API key generation, validation, and lifecycle management
 * for machine-to-machine authentication. Keys are hashed using bcrypt before
 * storage and never returned in plaintext after initial creation.
 *
 * All validation operations use constant-time comparison to prevent timing attacks.
 */
@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new cryptographically secure API key
   *
   * Creates a random API key using Node.js crypto module for cryptographic security.
   * Format: camp_sk_<32_base64url_characters>
   *
   * Security properties:
   * - Uses crypto.randomBytes() for CSPRNG (cryptographically secure pseudo-random number generator)
   * - 24 random bytes provides 192 bits of entropy
   * - Base64url encoding ensures URL-safe transmission (no +, /, or = characters)
   * - Prefix "camp_sk_" identifies key type for easy detection and rotation
   *
   * @returns {string} Generated API key in format camp_sk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   * @private This method is only used internally during key creation
   *
   * @example
   * const key = this.generateApiKey();
   * // Returns: "camp_sk_Kx7p3R9mN2qY8jL4tW6vB5nC1hF0sD"
   */
  private generateApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const randomString = randomBytes.toString('base64url').substring(0, 32);
    return `camp_sk_${randomString}`;
  }

  /**
   * Create a new API key for programmatic authentication
   *
   * Generates a secure random API key, hashes it using bcrypt, and stores it in the database.
   * The plaintext key is returned ONLY ONCE during creation - it cannot be retrieved later.
   *
   * Security workflow:
   * 1. Generate cryptographically secure random key
   * 2. Hash key using bcrypt (same as passwords)
   * 3. Store only hashed version in database
   * 4. Return plaintext key to user (one-time display)
   * 5. User must save key immediately; cannot be recovered
   *
   * The key can optionally be scoped to specific permissions and/or a single campaign,
   * and can have an expiration date for enhanced security.
   *
   * @param {CreateApiKeyData} data - Configuration for the new API key
   * @param {string} data.userId - ID of user who will own this API key
   * @param {string} data.name - Human-readable name for identifying the key
   * @param {string[]} data.scopes - Permission scopes granted to this key
   * @param {string} [data.campaignId] - Optional campaign ID to restrict key access
   * @param {Date} [data.expiresAt] - Optional expiration date
   * @returns {Promise<{id: string, key: string, name: string}>} Object containing:
   *   - id: Database ID of created API key record
   *   - key: Plaintext API key (ONLY TIME THIS IS AVAILABLE)
   *   - name: Name of the API key
   *
   * @example
   * const result = await apiKeyService.create({
   *   userId: 'user-123',
   *   name: 'Production Server',
   *   scopes: ['read:campaigns', 'write:events'],
   *   campaignId: 'campaign-456',
   *   expiresAt: new Date('2025-12-31')
   * });
   * // result.key = "camp_sk_Kx7p3R9mN2qY8jL4tW6vB5nC1hF0sD"
   * // User must save result.key now - it cannot be retrieved later
   */
  async create(data: CreateApiKeyData): Promise<{ id: string; key: string; name: string }> {
    const apiKey = this.generateApiKey();
    const hashedKey = await hashPassword(apiKey);

    const created = await this.prisma.apiKey.create({
      data: {
        userId: data.userId,
        name: data.name,
        key: hashedKey,
        scopes: data.scopes,
        campaignId: data.campaignId,
        expiresAt: data.expiresAt,
      },
    });

    // Return the plain API key only once (user must save it)
    return {
      id: created.id,
      key: apiKey,
      name: created.name,
    };
  }

  /**
   * Validate an API key and return the associated user and permissions
   *
   * Validates a provided API key against all active keys in the database using constant-time
   * comparison to prevent timing attacks. On successful validation, returns user information
   * and key metadata (scopes, campaign restrictions).
   *
   * Validation process:
   * 1. Check key format (must start with "camp_sk_")
   * 2. Query all active (non-revoked, non-expired) API keys
   * 3. Use bcrypt to compare against each stored hashed key (constant-time)
   * 4. On match: update lastUsedAt timestamp and return user + permissions
   * 5. On no match: throw UnauthorizedException
   *
   * Security considerations:
   * - Uses constant-time comparison (bcrypt) to prevent timing attacks
   * - Checks all active keys rather than pre-filtering to avoid revealing which keys exist
   * - Validates expiration and revocation status
   * - Updates last-used timestamp for audit/security monitoring
   *
   * @param {string} apiKey - The plaintext API key to validate (format: camp_sk_...)
   * @returns {Promise<{user: {id: string, email: string, name: string}, apiKey: {id: string, scopes: unknown, campaignId: string | null}}>}
   *   Object containing validated user and API key metadata:
   *   - user: User information (id, email, name)
   *   - apiKey: Key metadata (id, scopes array, optional campaignId restriction)
   * @throws {UnauthorizedException} If key format is invalid
   * @throws {UnauthorizedException} If key doesn't match any active keys
   * @throws {UnauthorizedException} If key is revoked or expired (implicitly via query filter)
   *
   * @example
   * const result = await apiKeyService.validate('camp_sk_Kx7p3R9mN2qY8jL4tW6vB5nC1hF0sD');
   * // Returns: {
   * //   user: { id: 'user-123', email: 'user@example.com', name: 'John Doe' },
   * //   apiKey: { id: 'key-789', scopes: ['read:campaigns'], campaignId: 'campaign-456' }
   * // }
   */
  async validate(apiKey: string): Promise<{
    user: { id: string; email: string; name: string };
    apiKey: { id: string; scopes: unknown; campaignId: string | null };
  }> {
    if (!apiKey.startsWith('camp_sk_')) {
      throw new UnauthorizedException('Invalid API key format');
    }

    // Find all non-revoked API keys
    const keys = await this.prisma.apiKey.findMany({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Check if the provided key matches any stored key
    for (const storedKey of keys) {
      const isMatch = await comparePassword(apiKey, storedKey.key);
      if (isMatch) {
        // Update last used timestamp
        await this.prisma.apiKey.update({
          where: { id: storedKey.id },
          data: { lastUsedAt: new Date() },
        });

        return {
          user: storedKey.user,
          apiKey: {
            id: storedKey.id,
            scopes: storedKey.scopes,
            campaignId: storedKey.campaignId,
          },
        };
      }
    }

    throw new UnauthorizedException('Invalid API key');
  }

  /**
   * Get all active API keys for a user (metadata only, no plaintext keys)
   *
   * Returns a list of all non-revoked API keys belonging to a specific user.
   * Only returns metadata - the plaintext keys are never stored or returned
   * after initial creation.
   *
   * Useful for:
   * - Displaying user's API keys in account settings
   * - Monitoring key usage via lastUsedAt timestamps
   * - Managing key lifecycle (identifying unused or expired keys)
   *
   * @param {string} userId - ID of the user whose API keys to retrieve
   * @returns {Promise<Array<{id: string, name: string, scopes: unknown, campaignId: string | null, expiresAt: Date | null, lastUsedAt: Date | null, createdAt: Date}>>}
   *   Array of API key metadata objects (excludes the hashed key value)
   *
   * @example
   * const keys = await apiKeyService.getUserApiKeys('user-123');
   * // Returns: [
   * //   {
   * //     id: 'key-789',
   * //     name: 'Production Server',
   * //     scopes: ['read:campaigns', 'write:events'],
   * //     campaignId: 'campaign-456',
   * //     expiresAt: new Date('2025-12-31'),
   * //     lastUsedAt: new Date('2025-11-10'),
   * //     createdAt: new Date('2025-01-01')
   * //   }
   * // ]
   */
  async getUserApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        campaignId: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Revoke an API key immediately
   *
   * Marks an API key as revoked by setting the revokedAt timestamp. Revoked keys
   * are excluded from validation queries and cannot be used for authentication.
   *
   * Security features:
   * - Requires both key ID and user ID to prevent unauthorized revocation
   * - Uses updateMany to ensure atomic operation with ownership verification
   * - Soft delete (sets timestamp) rather than hard delete for audit trail
   * - Immediate effect - key becomes invalid on next validation attempt
   *
   * Common use cases:
   * - User manually revokes key from account settings
   * - Key suspected to be compromised
   * - Rotating keys (revoke old, create new)
   * - User access removed (revoke all their keys)
   *
   * @param {string} id - ID of the API key to revoke
   * @param {string} userId - ID of the user who owns the key (for authorization)
   * @returns {Promise<Prisma.BatchPayload>} Prisma batch payload (count of updated records)
   *
   * @example
   * const result = await apiKeyService.revoke('key-789', 'user-123');
   * // result.count = 1 if key was revoked, 0 if key not found or user doesn't own it
   */
  async revoke(id: string, userId: string) {
    return this.prisma.apiKey.updateMany({
      where: {
        id,
        userId, // Ensure user owns the key
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Check if an API key has a specific permission scope
   *
   * Helper method for authorization checks in guards and resolvers. Determines if
   * an API key's scope array includes a required permission scope.
   *
   * Handles scope data in multiple formats:
   * - Array format: ['read:campaigns', 'write:events']
   * - JSON string format: '["read:campaigns", "write:events"]'
   *
   * Scope naming convention: <action>:<resource>
   * - Examples: "read:campaigns", "write:events", "admin:all"
   *
   * @param {unknown} scopes - The scopes array from API key metadata (may be array or JSON string)
   * @param {string} requiredScope - The scope to check for (e.g., "read:campaigns")
   * @returns {boolean} True if the API key has the required scope, false otherwise
   *
   * @example
   * const hasPermission = apiKeyService.hasScope(
   *   ['read:campaigns', 'write:events'],
   *   'read:campaigns'
   * ); // Returns: true
   *
   * @example
   * const hasPermission = apiKeyService.hasScope(
   *   '["read:campaigns"]',
   *   'write:events'
   * ); // Returns: false
   */
  hasScope(scopes: unknown, requiredScope: string): boolean {
    let scopeArray: string[];
    if (!Array.isArray(scopes)) {
      scopeArray = JSON.parse(scopes as string) as string[];
    } else {
      scopeArray = scopes;
    }
    return scopeArray.includes(requiredScope);
  }
}
