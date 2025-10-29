import { ConflictType, MergeConflict } from './merge.service';

/**
 * Result of conflict detection analysis
 */
export interface ConflictDetectionResult {
  /** Whether any conflicts were detected */
  hasConflicts: boolean;
  /** List of detected conflicts */
  conflicts: MergeConflict[];
  /** Merged payload if no conflicts, null if conflicts exist */
  mergedPayload: Record<string, unknown> | null;
}

/**
 * Represents a change made in a branch
 */
interface PropertyChange {
  /** JSON path to the property */
  path: string;
  /** Value in base version */
  baseValue: unknown;
  /** Value in source version */
  sourceValue: unknown;
  /** Value in target version */
  targetValue: unknown;
  /** Whether source changed from base */
  sourceChanged: boolean;
  /** Whether target changed from base */
  targetChanged: boolean;
}

/**
 * Service for detecting merge conflicts between versions using 3-way merge algorithm.
 * Analyzes base, source, and target versions to identify conflicting changes.
 */
export class ConflictDetector {
  /**
   * Detect conflicts between three versions of an entity payload.
   * Uses 3-way merge algorithm:
   * - Auto-resolve if only one branch changed
   * - Conflict if both branches changed differently
   * - Keep base if neither changed
   *
   * @param basePayload - Payload from common ancestor (null if entity didn't exist)
   * @param sourcePayload - Payload from source branch (null if entity deleted)
   * @param targetPayload - Payload from target branch (null if entity deleted)
   * @returns Conflict detection result with conflicts and merged payload
   */
  detectPropertyConflicts(
    basePayload: Record<string, unknown> | null,
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): ConflictDetectionResult {
    // Handle entity-level deletion scenarios
    if (this.isEntityDeletion(basePayload, sourcePayload, targetPayload)) {
      return this.handleEntityDeletion(basePayload, sourcePayload, targetPayload);
    }

    // Handle entity creation scenarios (didn't exist in base)
    if (basePayload === null) {
      return this.handleEntityCreation(sourcePayload, targetPayload);
    }

    // Normal case: entity exists in all three versions (or at least base)
    const conflicts: MergeConflict[] = [];
    const mergedPayload: Record<string, unknown> = {};

    // Get all unique property paths from all three versions
    const allPaths = this.getAllPropertyPaths(basePayload, sourcePayload, targetPayload);

    // Analyze each property path for conflicts
    for (const path of allPaths) {
      const change = this.getPropertyChange(path, basePayload, sourcePayload, targetPayload);

      // Detect if this property has a conflict
      const conflict = this.detectConflict(change);

      if (conflict) {
        conflicts.push(conflict);
      } else {
        // Auto-resolve: set the merged value
        const resolvedValue = this.autoResolveProperty(change);
        this.setPropertyAtPath(mergedPayload, path, resolvedValue);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      mergedPayload: conflicts.length > 0 ? null : mergedPayload,
    };
  }

  /**
   * Check if this is an entity deletion scenario
   */
  private isEntityDeletion(
    basePayload: Record<string, unknown> | null,
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): boolean {
    return basePayload !== null && (sourcePayload === null || targetPayload === null);
  }

  /**
   * Handle scenarios where entity was deleted in one or both branches
   */
  private handleEntityDeletion(
    basePayload: Record<string, unknown> | null,
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): ConflictDetectionResult {
    // Both branches deleted - auto-resolve to deletion
    if (sourcePayload === null && targetPayload === null) {
      return {
        hasConflicts: false,
        conflicts: [],
        mergedPayload: null,
      };
    }

    // One branch deleted, other modified - major conflict
    // Return all properties as conflicts
    const nonNullPayload = (sourcePayload || targetPayload) as Record<string, unknown>;
    const allPaths = this.getAllPropertyPaths(basePayload, nonNullPayload, nonNullPayload);

    const conflicts: MergeConflict[] = allPaths.map((path) => {
      const baseValue = this.getPropertyAtPath(basePayload!, path);
      const sourceValue = sourcePayload ? this.getPropertyAtPath(sourcePayload, path) : undefined;
      const targetValue = targetPayload ? this.getPropertyAtPath(targetPayload, path) : undefined;

      return {
        path,
        type:
          sourcePayload === null ? ConflictType.DELETED_MODIFIED : ConflictType.MODIFIED_DELETED,
        baseValue,
        sourceValue,
        targetValue,
      };
    });

    return {
      hasConflicts: true,
      conflicts,
      mergedPayload: null,
    };
  }

  /**
   * Handle scenarios where entity was created in one or both branches
   * (didn't exist in base)
   */
  private handleEntityCreation(
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): ConflictDetectionResult {
    // Both branches created the entity
    if (sourcePayload && targetPayload) {
      // Treat as if base was empty object and detect conflicts normally
      return this.detectPropertyConflicts({}, sourcePayload, targetPayload);
    }

    // Only one branch created it - auto-resolve to that version
    return {
      hasConflicts: false,
      conflicts: [],
      mergedPayload: (sourcePayload || targetPayload) as Record<string, unknown>,
    };
  }

  /**
   * Get all unique property paths from all three versions (including nested paths)
   */
  private getAllPropertyPaths(...payloads: (Record<string, unknown> | null)[]): string[] {
    const pathSet = new Set<string>();

    for (const payload of payloads) {
      if (payload) {
        this.collectPaths(payload, '', pathSet);
      }
    }

    return Array.from(pathSet).sort();
  }

  /**
   * Recursively collect all paths from an object (including nested)
   */
  private collectPaths(obj: unknown, prefix: string, pathSet: Set<string>): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj !== 'object' || Array.isArray(obj)) {
      // Leaf node (primitive or array) - add the path
      if (prefix) {
        pathSet.add(prefix);
      }
      return;
    }

    // Object - recurse into properties
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record);

    if (keys.length === 0 && prefix) {
      // Empty object - add the path
      pathSet.add(prefix);
      return;
    }

    for (const key of keys) {
      const newPath = prefix ? `${prefix}.${key}` : key;
      this.collectPaths(record[key], newPath, pathSet);
    }
  }

  /**
   * Get property change information for a specific path
   */
  private getPropertyChange(
    path: string,
    basePayload: Record<string, unknown>,
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): PropertyChange {
    const baseValue = this.getPropertyAtPath(basePayload, path);
    const sourceValue = sourcePayload ? this.getPropertyAtPath(sourcePayload, path) : undefined;
    const targetValue = targetPayload ? this.getPropertyAtPath(targetPayload, path) : undefined;

    return {
      path,
      baseValue,
      sourceValue,
      targetValue,
      sourceChanged: !this.valuesEqual(baseValue, sourceValue),
      targetChanged: !this.valuesEqual(baseValue, targetValue),
    };
  }

  /**
   * Detect if a property change represents a conflict
   */
  private detectConflict(change: PropertyChange): MergeConflict | null {
    const { path, baseValue, sourceValue, targetValue, sourceChanged, targetChanged } = change;

    // Neither changed - no conflict
    if (!sourceChanged && !targetChanged) {
      return null;
    }

    // Only one changed - no conflict (auto-resolve)
    if (sourceChanged && !targetChanged) {
      return null;
    }
    if (!sourceChanged && targetChanged) {
      return null;
    }

    // Both changed - check if they changed to the same value
    if (this.valuesEqual(sourceValue, targetValue)) {
      // Both made identical changes - no conflict
      return null;
    }

    // Both changed differently - conflict!
    const type = this.determineConflictType(baseValue, sourceValue, targetValue);

    return {
      path,
      type,
      baseValue,
      sourceValue,
      targetValue,
    };
  }

  /**
   * Determine the specific type of conflict
   */
  private determineConflictType(
    baseValue: unknown,
    sourceValue: unknown,
    targetValue: unknown
  ): ConflictType {
    const baseExists = baseValue !== undefined;
    const sourceExists = sourceValue !== undefined;
    const targetExists = targetValue !== undefined;

    // Both deleted
    if (baseExists && !sourceExists && !targetExists) {
      return ConflictType.BOTH_DELETED;
    }

    // Source modified, target deleted
    if (sourceExists && !targetExists) {
      return ConflictType.MODIFIED_DELETED;
    }

    // Source deleted, target modified
    if (!sourceExists && targetExists) {
      return ConflictType.DELETED_MODIFIED;
    }

    // Both modified (most common case)
    return ConflictType.BOTH_MODIFIED;
  }

  /**
   * Auto-resolve a property value when there's no conflict
   */
  private autoResolveProperty(change: PropertyChange): unknown {
    const { baseValue, sourceValue, targetValue, sourceChanged, targetChanged } = change;

    // If both changed to same value, use that value
    if (sourceChanged && targetChanged && this.valuesEqual(sourceValue, targetValue)) {
      return sourceValue;
    }

    // If only source changed, use source value
    if (sourceChanged) {
      return sourceValue;
    }

    // If only target changed, use target value
    if (targetChanged) {
      return targetValue;
    }

    // Neither changed, use base value
    return baseValue;
  }

  /**
   * Get property value at a dot-separated path (e.g., "resources.gold")
   */
  private getPropertyAtPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Set property value at a dot-separated path (e.g., "resources.gold")
   */
  private setPropertyAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;

    // Navigate to parent object
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (
        !(part in current) ||
        typeof current[part] !== 'object' ||
        current[part] === null ||
        Array.isArray(current[part])
      ) {
        // Create intermediate object
        current[part] = {};
      }

      current = current[part] as Record<string, unknown>;
    }

    // Set the value
    const lastPart = parts[parts.length - 1];
    if (value === undefined) {
      delete current[lastPart];
    } else {
      current[lastPart] = value;
    }
  }

  /**
   * Deep equality check for values (handles primitives, objects, arrays)
   */
  private valuesEqual(a: unknown, b: unknown): boolean {
    // Strict equality for primitives and same reference
    if (a === b) {
      return true;
    }

    // Handle null and undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return false;
      }
      return a.every((val, idx) => this.valuesEqual(val, b[idx]));
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const aKeys = Object.keys(a as Record<string, unknown>).sort();
      const bKeys = Object.keys(b as Record<string, unknown>).sort();

      if (aKeys.length !== bKeys.length) {
        return false;
      }

      if (!aKeys.every((key, idx) => key === bKeys[idx])) {
        return false;
      }

      return aKeys.every((key) =>
        this.valuesEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
      );
    }

    // Different types or values
    return false;
  }
}
