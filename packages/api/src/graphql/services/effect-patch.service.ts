/**
 * EffectPatchService
 *
 * Handles JSON Patch (RFC 6902) operations for effect system with security validation.
 * Provides immutable patch application with path whitelisting per entity type.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as jsonpatch from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';

/**
 * Entity types that can be modified by effects
 */
export type PatchableEntityType = 'SETTLEMENT' | 'STRUCTURE' | 'KINGDOM' | 'ENCOUNTER' | 'EVENT';

/**
 * Result of patch validation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Result of patch application
 */
export interface ApplyPatchResult<T = unknown> {
  success: boolean;
  patchedEntity: T | null;
  errors: string[];
}

/**
 * Result of patch preview generation
 */
export interface PatchPreviewResult<T = unknown> {
  success: boolean;
  before: T;
  after: T | null;
  changedFields: string[];
  errors: string[];
}

/**
 * Protected fields that cannot be modified via patches (common across all entities)
 */
const PROTECTED_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'version', // Used for optimistic locking
];

/**
 * Additional protected fields per entity type
 * These are typically foreign keys or critical system fields
 */
const ENTITY_PROTECTED_FIELDS: Record<PatchableEntityType, string[]> = {
  SETTLEMENT: ['campaignId', 'kingdomId', 'locationId'],
  STRUCTURE: ['settlementId'],
  KINGDOM: ['campaignId'],
  ENCOUNTER: ['campaignId', 'eventId'],
  EVENT: ['campaignId', 'encounterId'],
};

/**
 * Valid RFC 6902 operation types
 */
const VALID_OPERATIONS = ['add', 'remove', 'replace', 'copy', 'move', 'test'];

@Injectable()
export class EffectPatchService {
  private readonly logger = new Logger(EffectPatchService.name);

  /**
   * Validates a JSON Patch against security rules and format requirements
   *
   * @param patch - Array of RFC 6902 patch operations
   * @param entityType - Type of entity being patched (for path whitelisting)
   * @returns Validation result with list of errors
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
   * Validates a single path against protected field rules
   *
   * @param path - JSON Pointer path (e.g., "/name" or "/metadata/key")
   * @param entityType - Type of entity being patched
   * @returns Error message if path is invalid, null if valid
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
   * Applies a JSON Patch to an entity immutably
   *
   * @param entity - Original entity object
   * @param patch - Array of RFC 6902 patch operations
   * @param entityType - Type of entity being patched
   * @returns Result containing patched entity or errors
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
   * Generates a preview of patch application showing before/after and changed fields
   *
   * @param entity - Original entity object
   * @param patch - Array of RFC 6902 patch operations
   * @param entityType - Type of entity being patched
   * @returns Preview result with before/after snapshots and changed fields
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
   * Identifies which top-level fields changed between two objects
   *
   * @param before - Original object
   * @param after - Modified object
   * @returns Array of changed field names
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
   * Deep equality check for two values
   *
   * @param a - First value
   * @param b - Second value
   * @returns True if values are deeply equal
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    // Handle primitives and null/undefined
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    if (typeof a !== typeof b) return false;

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
   * Creates a deep clone of an object
   *
   * @param obj - Object to clone
   * @returns Deep cloned object
   */
  private deepClone<T>(obj: T): T {
    // Use JSON serialization for deep cloning
    // This is safe for our use case as entities are JSON-serializable
    return JSON.parse(JSON.stringify(obj));
  }
}
