import type { EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import { CustomEdge } from './CustomEdge';

/**
 * DependsOnEdge - Represents a "DEPENDS_ON" relationship in the dependency graph.
 *
 * Visual characteristics:
 * - Dotted line (2,2 pattern) for subtle dependency indicator
 * - Purple color (#a855f7 - purple-500)
 * - Standard stroke width (2px)
 * - Arrow marker at the end
 *
 * Meaning: The source node depends on the target node (e.g., one condition depends on another condition's result).
 *
 * Part of TICKET-021 Stage 5 implementation.
 */
function DependsOnEdgeComponent(props: EdgeProps) {
  return (
    <CustomEdge
      {...props}
      strokeColor="#a855f7" // purple-500 for dependencies
      strokeWidth={2}
      strokeDasharray="2,2"
      animated={false}
    />
  );
}

/**
 * Memoized DependsOnEdge component to prevent unnecessary re-renders.
 */
export const DependsOnEdge = memo(DependsOnEdgeComponent);
