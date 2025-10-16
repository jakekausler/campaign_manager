/**
 * Shared TypeScript type definitions
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
export type EntityType = 'location' | 'encounter' | 'event' | 'character';
export * from './geojson';
//# sourceMappingURL=index.d.ts.map
