import type { EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import { CustomEdge } from './CustomEdge';

/**
 * ReadsEdge - Represents a "READS" relationship in the dependency graph.
 *
 * Visual characteristics:
 * - Solid line (no dash pattern)
 * - Blue-gray color (#64748b - slate-500)
 * - Standard stroke width (2px)
 * - Arrow marker at the end
 *
 * Meaning: The source node reads data from the target node (e.g., a condition reads a variable value).
 *
 * Part of TICKET-021 Stage 5 implementation.
 */
function ReadsEdgeComponent(props: EdgeProps) {
  return (
    <CustomEdge
      {...props}
      strokeColor="#64748b" // slate-500
      strokeWidth={2}
      animated={false}
    />
  );
}

/**
 * Memoized ReadsEdge component to prevent unnecessary re-renders.
 */
export const ReadsEdge = memo(ReadsEdgeComponent);
