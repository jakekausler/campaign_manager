import { ConflictDetector, ConflictDetectionResult } from './conflict-detector';
import { MergeConflict } from './merge.service';

/**
 * Settlement-specific merge handler that extends the generic conflict detection
 * with domain-specific descriptions and validation.
 *
 * Delegates to the base ConflictDetector for the core 3-way merge algorithm,
 * then enhances the results with Settlement-specific semantic information.
 */
export class SettlementMergeHandler {
  private readonly conflictDetector: ConflictDetector;

  constructor() {
    this.conflictDetector = new ConflictDetector();
  }

  /**
   * Detect conflicts between three versions of a Settlement entity.
   * Uses the generic ConflictDetector for the core algorithm.
   *
   * @param basePayload - Settlement payload from common ancestor (null if entity didn't exist)
   * @param sourcePayload - Settlement payload from source branch (null if entity deleted)
   * @param targetPayload - Settlement payload from target branch (null if entity deleted)
   * @returns Conflict detection result with Settlement-specific enhancements
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
   * Generate a human-readable description for a Settlement conflict.
   * Provides domain-specific context for the conflict.
   *
   * @param conflict - The conflict to describe
   * @returns Human-readable description
   */
  getConflictDescription(conflict: MergeConflict): string {
    const { path, baseValue, sourceValue, targetValue } = conflict;

    // Handle well-known Settlement properties with semantic descriptions
    switch (path) {
      case 'name':
        return `Settlement name changed in both branches (source: "${sourceValue}", target: "${targetValue}")`;

      case 'kingdomId':
        return `Settlement was moved to different kingdoms in both branches (base: ${baseValue}, source: ${sourceValue}, target: ${targetValue})`;

      case 'locationId':
        return `Settlement location changed in both branches (source: ${sourceValue}, target: ${targetValue})`;

      case 'level':
        return `Settlement level changed in both branches (source: ${sourceValue}, target: ${targetValue})`;

      default:
        // Handle nested properties
        if (path.startsWith('variables.')) {
          const variablePath = path.substring('variables.'.length);
          return `Settlement variable "${variablePath}" modified in both branches`;
        }

        // Generic fallback
        return `Settlement property "${path}" changed in both branches`;
    }
  }

  /**
   * Get a suggestion for resolving a Settlement conflict.
   * Provides domain-specific guidance.
   *
   * @param conflict - The conflict to provide suggestion for
   * @returns Suggested resolution or undefined if no specific suggestion
   */
  getConflictSuggestion(conflict: MergeConflict): string | undefined {
    const { path } = conflict;

    switch (path) {
      case 'kingdomId':
        return 'Moving settlements between kingdoms is a significant change - verify the intended kingdom assignment';

      case 'locationId':
        return 'Changing settlement location may affect spatial relationships - review the map to ensure consistency';

      case 'level':
        return 'Settlement level affects gameplay mechanics - consider which branch has the authoritative progression';

      default:
        if (path.startsWith('variables.population')) {
          return 'Population changes may reflect different gameplay events - review both timelines';
        }

        if (path.startsWith('variables.resources')) {
          return 'Resource conflicts may be resolved by summing changes or choosing the higher value';
        }

        return undefined;
    }
  }
}
