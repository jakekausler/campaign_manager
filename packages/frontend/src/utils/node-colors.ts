/**
 * Color constants for dependency graph node types.
 *
 * Each node type has a distinct color scheme to make them easily identifiable:
 * - VARIABLE: Green - represents data storage
 * - CONDITION: Blue - represents logic/rules
 * - EFFECT: Orange - represents side effects/actions
 * - ENTITY: Purple - represents game entities
 *
 * Colors use Tailwind CSS color palette for consistency with the rest of the app.
 * Background colors are -500 variants, borders are -600 variants (darker).
 */

import type { DependencyNodeType } from '@/services/api/hooks';

export const NODE_COLORS = {
  VARIABLE: {
    bg: '#22c55e', // green-500
    border: '#16a34a', // green-600
  },
  CONDITION: {
    bg: '#3b82f6', // blue-500
    border: '#2563eb', // blue-600
  },
  EFFECT: {
    bg: '#f97316', // orange-500
    border: '#ea580c', // orange-600
  },
  ENTITY: {
    bg: '#a855f7', // purple-500
    border: '#9333ea', // purple-600
  },
} as const satisfies Record<DependencyNodeType, { bg: string; border: string }>;
