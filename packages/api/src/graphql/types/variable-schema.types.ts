/**
 * Variable Schema Types
 * Type definitions for typed variable schemas
 */

export type VariableType = 'string' | 'number' | 'boolean' | 'enum';

export type EntityType = 'party' | 'kingdom' | 'settlement' | 'structure';

export interface VariableSchema {
  name: string;
  type: VariableType;
  enumValues?: string[];
  defaultValue?: unknown;
  description?: string;
}
