import { BadRequestException } from '@nestjs/common';

/**
 * Configuration for level range validation.
 * Default ranges are based on typical D&D 5e level progression.
 */
export interface LevelRangeConfig {
  min: number;
  max: number;
  entityType: 'party' | 'kingdom' | 'settlement' | 'structure' | 'character';
}

/**
 * Default level range configurations for different entity types.
 */
export const DEFAULT_LEVEL_RANGES: Record<string, LevelRangeConfig> = {
  party: { min: 1, max: 20, entityType: 'party' },
  character: { min: 1, max: 20, entityType: 'character' },
  kingdom: { min: 1, max: 10, entityType: 'kingdom' },
  settlement: { min: 1, max: 10, entityType: 'settlement' },
  structure: { min: 1, max: 5, entityType: 'structure' },
};

/**
 * LevelValidator provides level range validation for all entity types.
 * Supports custom level ranges per campaign/entity type.
 */
export class LevelValidator {
  /**
   * Validates that a level value is within the allowed range for an entity type.
   *
   * @param level - The level value to validate
   * @param entityType - The type of entity (party, kingdom, settlement, structure)
   * @param customRange - Optional custom range override (for campaign-specific rules)
   * @throws BadRequestException if level is out of range or invalid
   */
  static validateLevel(
    level: number,
    entityType: 'party' | 'kingdom' | 'settlement' | 'structure' | 'character',
    customRange?: Partial<LevelRangeConfig>
  ): void {
    // Type validation
    if (typeof level !== 'number' || Number.isNaN(level)) {
      throw new BadRequestException(`Level must be a valid number, but received ${typeof level}`);
    }

    // Integer validation
    if (!Number.isInteger(level)) {
      throw new BadRequestException(`Level must be an integer, but received ${level}`);
    }

    // Get range config (custom overrides default)
    const defaultRange = DEFAULT_LEVEL_RANGES[entityType];
    const range: LevelRangeConfig = {
      ...defaultRange,
      ...customRange,
    };

    // Range validation
    if (level < range.min || level > range.max) {
      throw new BadRequestException(
        `${this.capitalize(entityType)} level must be between ${range.min} and ${range.max}, but received ${level}`
      );
    }
  }

  /**
   * Validates level and returns normalized value.
   * Useful for chaining in service methods.
   *
   * @param level - The level value to validate
   * @param entityType - The type of entity
   * @param customRange - Optional custom range override
   * @returns The validated level value
   */
  static validate(
    level: number,
    entityType: 'party' | 'kingdom' | 'settlement' | 'structure' | 'character',
    customRange?: Partial<LevelRangeConfig>
  ): number {
    this.validateLevel(level, entityType, customRange);
    return level;
  }

  /**
   * Gets the level range configuration for an entity type.
   *
   * @param entityType - The type of entity
   * @param customRange - Optional custom range override
   * @returns The level range configuration
   */
  static getRange(
    entityType: 'party' | 'kingdom' | 'settlement' | 'structure' | 'character',
    customRange?: Partial<LevelRangeConfig>
  ): LevelRangeConfig {
    const defaultRange = DEFAULT_LEVEL_RANGES[entityType];
    return {
      ...defaultRange,
      ...customRange,
    };
  }

  /**
   * Helper to capitalize entity type names for error messages.
   */
  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
