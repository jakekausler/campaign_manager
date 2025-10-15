/**
 * Shared TypeScript type definitions
 */

// Base entity type that all domain objects extend
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Placeholder - will be expanded in later tickets
export type EntityType = 'location' | 'encounter' | 'event' | 'character';
