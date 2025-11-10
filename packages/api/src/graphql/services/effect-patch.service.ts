/**
 * @fileoverview Effect Patch Service - JSON Patch Operations for World State Mutations
 *
 * Provides secure JSON Patch (RFC 6902) operations for the effect system with immutable
 * patch application, path whitelisting, and validation. Enables world state mutations
 * by applying structured changes to game entities while preventing unauthorized
 * modifications to protected fields.
 *
 * Key responsibilities:
 * - Validates JSON Patch operations against RFC 6902 format requirements
 * - Enforces security rules with protected field whitelisting per entity type
 * - Applies patches immutably using fast-json-patch library
 * - Generates patch previews showing before/after states and changed fields
 * - Identifies field-level changes for audit and UI purposes
 *
 * Security model:
 * - Global protected fields (id, timestamps, version) cannot be modified
 * - Entity-specific protected fields (foreign keys, system fields) are enforced
 * - All paths validated before patch application
 * - Immutable operations prevent unintended side effects
 *
 * Supports all RFC 6902 operations:
 * - add: Insert value at path
 * - remove: Delete value at path
 * - replace: Update value at path
 * - copy: Duplicate value from one path to another
 * - move: Relocate value from one path to another
 * - test: Verify value at path matches expected value
 *
 * @see docs/features/effect-system.md for effect system architecture
 * @see https://datatracker.ietf.org/doc/html/rfc6902 for JSON Patch specification
 * @module graphql/services/effect-patch
 */

import { Injectable, Logger } from '@nestjs/common';
import * as jsonpatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';

/**
 * Entity types that can be modified by effects.
 *
 * These types have validated schemas and protected field configurations.
 * Each type has specific rules about which fields can be modified via patches.
 */
export type PatchableEntityType = 'SETTLEMENT' | 'STRUCTURE' | 'KINGDOM' | 'ENCOUNTER' | 'EVENT';

/**
 * Result of patch validation.
 *
 * Indicates whether a patch array is valid according to RFC 6902 format
 * and security rules (protected fields, path validation).
 */
export interface ValidationResult {
  /** Whether the patch is valid and safe to apply */
  valid: boolean;
  /** List of validation error messages (empty if valid) */
  errors: string[];
}

/**
 * Result of patch application.
 *
 * Contains either the successfully patched entity or error information
 * explaining why the patch could not be applied.
 */
export interface ApplyPatchResult<T = unknown> {
  /** Whether the patch was successfully applied */
  success: boolean;
  /** The modified entity (null if patch failed) */
  patchedEntity: T | null;
  /** List of error messages (empty if successful) */
  errors: string[];
}

/**
 * Result of patch preview generation.
 *
 * Provides before/after snapshots and a list of changed fields for
 * UI display or audit purposes without persisting changes.
 */
export interface PatchPreviewResult<T = unknown> {
  /** Whether the preview was successfully generated */
  success: boolean;
  /** Original entity state before patch */
  before: T;
  /** Modified entity state after patch (null if preview failed) */
  after: T | null;
  /** List of top-level field names that were modified */
  changedFields: string[];
  /** List of error messages (empty if successful) */
  errors: string[];
}

/**
 * Protected fields that cannot be modified via patches (common across all entities).
 *
 * These fields are critical to entity integrity and are managed by the system:
 * - id: Primary key identifier
 * - createdAt: Timestamp of entity creation
 * - updatedAt: Timestamp of last modification
 * - deletedAt: Soft delete timestamp
 * - version: Optimistic locking version number for concurrency control
 */
const PROTECTED_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'version', // Used for optimistic locking
];

/**
 * Additional protected fields per entity type.
 *
 * These are typically foreign keys or critical system fields that define
 * entity relationships and must not be modified after creation to maintain
 * referential integrity:
 * - SETTLEMENT: campaignId (ownership), kingdomId (affiliation), locationId (geography)
 * - STRUCTURE: settlementId (parent container)
 * - KINGDOM: campaignId (ownership)
 * - ENCOUNTER: campaignId (ownership), eventId (parent event link)
 * - EVENT: campaignId (ownership), encounterId (parent encounter link)
 */
const ENTITY_PROTECTED_FIELDS: Record<PatchableEntityType, string[]> = {
  SETTLEMENT: ['campaignId', 'kingdomId', 'locationId'],
  STRUCTURE: ['settlementId'],
  KINGDOM: ['campaignId'],
  ENCOUNTER: ['campaignId', 'eventId'],
  EVENT: ['campaignId', 'encounterId'],
};

/**
 * Valid RFC 6902 operation types.
 *
 * All six standard JSON Patch operations as defined by RFC 6902:
 * - add: Insert a value at the specified path
 * - remove: Delete the value at the specified path
 * - replace: Replace the value at the specified path
 * - copy: Copy the value from one path to another
 * - move: Move the value from one path to another
 * - test: Verify that the value at the specified path matches the expected value
 */
const VALID_OPERATIONS = ['add', 'remove', 'replace', 'copy', 'move', 'test'];

/**
 * Effect Patch Service - JSON Patch Operations for World State Mutations
 *
 * Provides secure, validated JSON Patch operations for modifying game entities
 * as part of the effect system. All operations are immutable and enforce
 * security rules to prevent unauthorized modifications.
 *
 * Core capabilities:
 * - Validates patches against RFC 6902 specification
 * - Enforces protected field rules per entity type
 * - Applies patches immutably without side effects
 * - Generates previews showing changed fields
 * - Provides detailed error reporting for validation failures
 *
 * Usage example:
 * ```typescript
 * const patch = [
 *   { op: 'replace', path: '/population', value: 1500 },
 *   { op: 'add', path: '/buildings/tavern', value: { name: 'The Prancing Pony' } }
 * ];
 *
 * const validation = service.validatePatch(patch, 'SETTLEMENT');
 * if (validation.valid) {
 *   const result = service.applyPatch(settlement, patch, 'SETTLEMENT');
 *   if (result.success) {
 *     // Use result.patchedEntity
 *   }
 * }
 * ```
 *
 * @see docs/features/effect-system.md for integration with effect execution
 */
@Injectable()
export class EffectPatchService {
  private readonly logger = new Logger(EffectPatchService.name);

  /**
   * Validates a JSON Patch against security rules and format requirements.
   *
   * Performs comprehensive validation including:
   * - Array format verification
   * - Required field presence (op, path)
   * - Operation type validation (add, remove, replace, copy, move, test)
   * - Operation-specific requirements (value for add/replace/test, from for copy/move)
   * - Protected field checks (global and entity-specific)
   * - JSON Pointer path format validation
   *
   * Returns all validation errors to enable comprehensive error reporting.
   * A patch is valid only if all operations pass all validation checks.
   *
   * @param patch - Array of RFC 6902 patch operations to validate
   * @param entityType - Type of entity being patched (determines protected fields)
   * @returns Validation result with valid flag and detailed error messages
   *
   * @example
   * ```typescript
   * const patch = [{ op: 'replace', path: '/name', value: 'New Name' }];
   * const result = service.validatePatch(patch, 'SETTLEMENT');
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   * ```
   */
  validatePatch(patch: Operation[], entityType: PatchableEntityType): ValidationResult {
    const errors: string[] = [];

    // Validate patch is an array
    if (!Array.isArray(patch)) {
      errors.push('Patch must be an array of operations');
      return { valid: false, errors };
    }

    // Validate each operation
    for (let i = 0; i < patch.length; i++) {
      const operation = patch[i];

      // Check required fields
      if (!operation.op) {
        errors.push(`Invalid patch format: operation ${i} missing "op" field`);
        continue;
      }

      if (!operation.path) {
        errors.push(`Invalid patch format: operation ${i} missing "path" field`);
        continue;
      }

      // Validate operation type
      if (!VALID_OPERATIONS.includes(operation.op)) {
        errors.push(
          `Invalid operation type "${operation.op}" at index ${i}. Must be one of: ${VALID_OPERATIONS.join(', ')}`
        );
        continue;
      }

      // Validate operation-specific requirements
      // Use type assertion since we've validated operation.op is valid above
      const op = operation.op as 'add' | 'remove' | 'replace' | 'copy' | 'move' | 'test';

      if ((op === 'add' || op === 'replace' || op === 'test') && !('value' in operation)) {
        errors.push(`Operation "${op}" requires a "value" field`);
        continue;
      }

      if ((op === 'copy' || op === 'move') && !('from' in operation)) {
        errors.push(`Operation "${op}" requires a "from" field`);
        continue;
      }

      // Validate path is not protected
      const pathError = this.validatePath(operation.path, entityType);
      if (pathError) {
        errors.push(pathError);
      }

      // Validate "from" path for copy/move operations
      if ((operation.op === 'copy' || operation.op === 'move') && 'from' in operation) {
        const fromPathError = this.validatePath(operation.from as string, entityType);
        if (fromPathError) {
          errors.push(`Source path error: ${fromPathError}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates a single JSON Pointer path against protected field rules.
   *
   * Extracts the top-level field name from the path and checks it against
   * both global protected fields (id, timestamps) and entity-specific
   * protected fields (foreign keys, system fields).
   *
   * JSON Pointer paths use forward slashes as delimiters:
   * - "/name" → validates "name"
   * - "/metadata/description" → validates "metadata"
   * - "/buildings/0/name" → validates "buildings"
   *
   * Only the top-level field is validated because nested field modifications
   * are allowed as long as the parent field is not protected.
   *
   * @param path - JSON Pointer path from patch operation (e.g., "/name" or "/metadata/key")
   * @param entityType - Type of entity being patched (determines entity-specific rules)
   * @returns Error message string if path is invalid, null if path is valid
   *
   * @example
   * ```typescript
   * // Valid paths
   * validatePath('/name', 'SETTLEMENT'); // null (name not protected)
   * validatePath('/population', 'SETTLEMENT'); // null (population not protected)
   *
   * // Invalid paths
   * validatePath('/id', 'SETTLEMENT'); // Error: "id" is a protected field
   * validatePath('/campaignId', 'SETTLEMENT'); // Error: "campaignId" is protected for SETTLEMENT
   * ```
   */
  private validatePath(path: string, entityType: PatchableEntityType): string | null {
    // Extract top-level field from path (e.g., "/name" -> "name", "/metadata/key" -> "metadata")
    const pathParts = path.split('/').filter((part) => part.length > 0);
    if (pathParts.length === 0) {
      return 'Path cannot be empty or root';
    }

    const topLevelField = pathParts[0];

    // Check against global protected fields
    if (PROTECTED_FIELDS.includes(topLevelField)) {
      return `Path "${path}" is not allowed: "${topLevelField}" is a protected field`;
    }

    // Check against entity-specific protected fields
    const entityProtectedFields = ENTITY_PROTECTED_FIELDS[entityType] || [];
    if (entityProtectedFields.includes(topLevelField)) {
      return `Path "${path}" is not allowed: "${topLevelField}" is a protected field for ${entityType}`;
    }

    return null;
  }

  /**
   * Applies a JSON Patch to an entity immutably.
   *
   * Validates the patch first, then applies operations using the fast-json-patch
   * library. Creates a deep clone before applying operations to ensure the
   * original entity is never modified.
   *
   * Process:
   * 1. Validates patch format and protected fields
   * 2. Deep clones entity using structuredClone
   * 3. Validates patch operations against cloned entity
   * 4. Applies patch immutably (returns new object)
   * 5. Returns result with success flag and patched entity or errors
   *
   * If any validation or application step fails, returns an error result
   * with descriptive error messages.
   *
   * @param entity - Original entity object to patch
   * @param patch - Array of RFC 6902 patch operations to apply
   * @param entityType - Type of entity being patched (for validation rules)
   * @returns Result containing patched entity on success or error messages on failure
   *
   * @example
   * ```typescript
   * const settlement = { id: 1, name: 'Waterdeep', population: 1000 };
   * const patch = [{ op: 'replace', path: '/population', value: 1200 }];
   *
   * const result = service.applyPatch(settlement, patch, 'SETTLEMENT');
   * if (result.success) {
   *   console.log('New population:', result.patchedEntity.population); // 1200
   *   console.log('Original unchanged:', settlement.population); // 1000
   * } else {
   *   console.error('Patch failed:', result.errors);
   * }
   * ```
   */
  applyPatch<T = unknown>(
    entity: T,
    patch: Operation[],
    entityType: PatchableEntityType
  ): ApplyPatchResult<T> {
    // Validate patch first
    const validation = this.validatePatch(patch, entityType);
    if (!validation.valid) {
      return {
        success: false,
        patchedEntity: null,
        errors: validation.errors,
      };
    }

    try {
      // Create deep clone to ensure immutability
      const entityClone = this.deepClone(entity);

      // Apply patch using fast-json-patch
      const patchErrors = jsonpatch.validate(patch, entityClone);
      if (patchErrors) {
        return {
          success: false,
          patchedEntity: null,
          errors: [patchErrors.message || 'Patch validation failed'],
        };
      }

      // Apply the patch
      // Parameters: (document, patch, validate=true, mutateDocument=false)
      // - validate: Perform additional validation during application
      // - mutateDocument: false ensures immutability (returns new document)
      const patchResult = jsonpatch.applyPatch(entityClone, patch, true, false);

      // Check if patch application succeeded
      if (!patchResult || !patchResult.newDocument) {
        return {
          success: false,
          patchedEntity: null,
          errors: ['Patch application failed'],
        };
      }

      return {
        success: true,
        patchedEntity: patchResult.newDocument as T,
        errors: [],
      };
    } catch (error) {
      this.logger.error(`Error applying patch to ${entityType}:`, error);
      return {
        success: false,
        patchedEntity: null,
        errors: [error instanceof Error ? error.message : 'Unknown patch application error'],
      };
    }
  }

  /**
   * Generates a preview of patch application showing before/after and changed fields.
   *
   * Useful for displaying patch effects in the UI before committing changes,
   * or for audit trails showing what changed. Applies the patch without
   * persisting changes and analyzes differences between states.
   *
   * Calls applyPatch internally, so validation and error handling are identical.
   * Additionally computes a list of changed field names by comparing before
   * and after states using deep equality checks.
   *
   * @param entity - Original entity object to preview changes for
   * @param patch - Array of RFC 6902 patch operations to preview
   * @param entityType - Type of entity being patched (for validation rules)
   * @returns Preview result with before/after snapshots, changed fields, and errors
   *
   * @example
   * ```typescript
   * const settlement = { id: 1, name: 'Waterdeep', population: 1000, gold: 5000 };
   * const patch = [
   *   { op: 'replace', path: '/population', value: 1200 },
   *   { op: 'replace', path: '/gold', value: 6000 }
   * ];
   *
   * const preview = service.generatePatchPreview(settlement, patch, 'SETTLEMENT');
   * if (preview.success) {
   *   console.log('Before:', preview.before);
   *   console.log('After:', preview.after);
   *   console.log('Changed fields:', preview.changedFields); // ['population', 'gold']
   * }
   * ```
   */
  generatePatchPreview<T = unknown>(
    entity: T,
    patch: Operation[],
    entityType: PatchableEntityType
  ): PatchPreviewResult<T> {
    // Try to apply the patch
    const result = this.applyPatch(entity, patch, entityType);

    if (!result.success || !result.patchedEntity) {
      return {
        success: false,
        before: entity,
        after: null,
        changedFields: [],
        errors: result.errors,
      };
    }

    // Identify changed fields by comparing before and after
    const changedFields = this.identifyChangedFields(entity, result.patchedEntity);

    return {
      success: true,
      before: entity,
      after: result.patchedEntity,
      changedFields,
      errors: [],
    };
  }

  /**
   * Identifies which top-level fields changed between two objects.
   *
   * Compares all properties in both objects using deep equality checks.
   * Returns a list of field names where values differ between before and after.
   *
   * Only top-level field names are returned, not nested paths:
   * - If /metadata/description changes, returns ["metadata"]
   * - If /buildings/0/name changes, returns ["buildings"]
   *
   * This is useful for:
   * - UI display of changed fields
   * - Audit logging of modifications
   * - Cache invalidation of affected fields
   *
   * @param before - Original object state
   * @param after - Modified object state
   * @returns Array of top-level field names that have different values
   *
   * @example
   * ```typescript
   * const before = { name: 'Old', population: 1000, gold: 5000 };
   * const after = { name: 'New', population: 1000, gold: 6000 };
   * const changed = identifyChangedFields(before, after);
   * // Returns: ['name', 'gold']
   * ```
   */
  private identifyChangedFields<T = unknown>(before: T, after: T): string[] {
    const changedFields: string[] = [];

    // Get all keys from both objects
    const beforeObj = before as Record<string, unknown>;
    const afterObj = after as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

    for (const key of allKeys) {
      const beforeValue = beforeObj[key];
      const afterValue = afterObj[key];

      // Field was added, removed, or modified
      if (!this.deepEqual(beforeValue, afterValue)) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  /**
   * Deep equality check for two values.
   *
   * Recursively compares values by content rather than reference. Handles:
   * - Primitives (string, number, boolean, null, undefined)
   * - Date objects (compared by timestamp)
   * - Arrays (compared element-by-element)
   * - Plain objects (compared property-by-property)
   *
   * Does not handle special cases like RegExp, Map, Set, typed arrays, or
   * circular references. For complex scenarios, consider using lodash.isEqual.
   *
   * Used internally to detect field changes in generatePatchPreview.
   *
   * @param a - First value to compare
   * @param b - Second value to compare
   * @returns True if values are deeply equal, false otherwise
   *
   * @example
   * ```typescript
   * deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }); // true
   * deepEqual([1, 2, 3], [1, 2, 3]); // true
   * deepEqual(new Date('2024-01-01'), new Date('2024-01-01')); // true
   * deepEqual({ a: 1 }, { a: 2 }); // false
   * ```
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    // Handle primitives and null/undefined
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;

    // Handle Date objects
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.deepEqual(item, b[index]));
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      return aKeys.every((key) => this.deepEqual(aObj[key], bObj[key]));
    }

    return false;
  }

  /**
   * Creates a deep clone of an object using the native structuredClone API.
   *
   * Advantages over JSON.parse(JSON.stringify()):
   * - Preserves Date objects (JSON stringify converts to strings)
   * - Handles circular references (JSON stringify throws)
   * - More performant for large objects
   * - Preserves undefined values (JSON stringify omits them)
   *
   * Used internally to ensure patch operations do not mutate the original entity.
   *
   * Note: structuredClone is available in Node.js 17+ and modern browsers.
   * This project requires Node.js 18+, so it is safe to use.
   *
   * @param obj - Object to clone
   * @returns Deep cloned object with independent reference
   *
   * @example
   * ```typescript
   * const original = { name: 'Waterdeep', date: new Date() };
   * const clone = deepClone(original);
   * clone.name = 'Baldur\'s Gate';
   * console.log(original.name); // Still 'Waterdeep'
   * ```
   */
  private deepClone<T>(obj: T): T {
    return structuredClone(obj);
  }
}
