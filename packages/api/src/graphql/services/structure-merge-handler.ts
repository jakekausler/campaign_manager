import { ConflictDetector, ConflictDetectionResult } from './conflict-detector';
import { MergeConflict } from './merge.service';

/**
 * Structure-specific merge handler that extends the generic conflict detection
 * with domain-specific descriptions and validation.
 *
 * Delegates to the base ConflictDetector for the core 3-way merge algorithm,
 * then enhances the results with Structure-specific semantic information.
 */
export class StructureMergeHandler {
  private readonly conflictDetector: ConflictDetector;

  constructor() {
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * Detect conflicts between three versions of a Structure entity.
   * Uses the generic ConflictDetector for the core algorithm.
   *
   * @param basePayload - Structure payload from common ancestor (null if entity didn't exist)
   * @param sourcePayload - Structure payload from source branch (null if entity deleted)
   * @param targetPayload - Structure payload from target branch (null if entity deleted)
   * @returns Conflict detection result with Structure-specific enhancements
   */
  detectConflicts(
    basePayload: Record<string, unknown> | null,
    sourcePayload: Record<string, unknown> | null,
    targetPayload: Record<string, unknown> | null
  ): ConflictDetectionResult {
    // Delegate to the generic conflict detector
    const result = this.conflictDetector.detectPropertyConflicts(
      basePayload,
      sourcePayload,
      targetPayload
    );

    // Result already contains conflicts and merged payload
    // Entity-specific handlers can enhance this with additional validation
    // or semantic conflict detection in the future

    return result;
  }

  /**
   * Generate a human-readable description for a Structure conflict.
   * Provides domain-specific context for the conflict.
   *
   * @param conflict - The conflict to describe
   * @returns Human-readable description
   */
  getConflictDescription(conflict: MergeConflict): string {
    const { path, baseValue, sourceValue, targetValue } = conflict;

    // Handle well-known Structure properties with semantic descriptions
    switch (path) {
      case 'name':
        return `Structure name changed in both branches (source: "${sourceValue}", target: "${targetValue}")`;

      case 'settlementId':
        return `Structure was moved to different settlements in both branches (base: ${baseValue}, source: ${sourceValue}, target: ${targetValue})`;

      case 'type':
        return `Structure type changed in both branches (source: "${sourceValue}", target: "${targetValue}")`;

      case 'level':
        return `Structure level changed in both branches (source: ${sourceValue}, target: ${targetValue})`;

      default:
        // Handle nested properties
        if (path.startsWith('variables.')) {
          const variablePath = path.substring('variables.'.length);

          // Special handling for common structure variables
          if (variablePath === 'defenseRating') {
            return `Structure defense rating changed in both branches (source: ${sourceValue}, target: ${targetValue})`;
          }
          if (variablePath === 'capacity') {
            return `Structure capacity changed in both branches (source: ${sourceValue}, target: ${targetValue})`;
          }
          if (variablePath === 'status') {
            return `Structure status changed in both branches (source: "${sourceValue}", target: "${targetValue}")`;
          }

          return `Structure variable "${variablePath}" modified in both branches`;
        }

        // Generic fallback
        return `Structure property "${path}" changed in both branches`;
    }
  }

  /**
   * Get a suggestion for resolving a Structure conflict.
   * Provides domain-specific guidance.
   *
   * @param conflict - The conflict to provide suggestion for
   * @returns Suggested resolution or undefined if no specific suggestion
   */
  getConflictSuggestion(conflict: MergeConflict): string | undefined {
    const { path } = conflict;

    switch (path) {
      case 'settlementId':
        return 'Moving structures between settlements is significant - verify the intended settlement assignment';

      case 'type':
        return 'Changing structure type is a major modification - review both timelines to understand the intent';

      case 'level':
        return 'Structure level affects capabilities and gameplay - consider which branch has the authoritative progression';

      default:
        if (path.startsWith('variables.defenseRating')) {
          return 'Defense rating conflicts may indicate different combat outcomes - review both battle timelines';
        }

        if (path.startsWith('variables.capacity')) {
          return 'Capacity conflicts may be resolved by choosing the higher value or reviewing upgrade timelines';
        }

        if (path.startsWith('variables.status')) {
          return 'Status conflicts (operational, damaged, destroyed) should reflect the most severe state or review timelines';
        }

        return undefined;
    }
  }
}
