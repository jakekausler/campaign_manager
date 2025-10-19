import type { EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import { CustomEdge } from './CustomEdge';

/**
 * WritesEdge - Represents a "WRITES" relationship in the dependency graph.
 *
 * Visual characteristics:
 * - Dashed line (5,5 pattern)
 * - Orange color (#f97316 - orange-500) for emphasis
 * - Standard stroke width (2px)
 * - Animated flow to indicate active mutation
 * - Arrow marker at the end
 *
 * Meaning: The source node writes/mutates data in the target node (e.g., an effect modifies a variable).
 *
 * Part of TICKET-021 Stage 5 implementation.
 */
function WritesEdgeComponent(props: EdgeProps) {
  return (
    <CustomEdge
      {...props}
      strokeColor="#f97316" // orange-500 for write operations
      strokeWidth={2}
      strokeDasharray="5,5"
      animated={true}
    />
  );
}

/**
 * Memoized WritesEdge component to prevent unnecessary re-renders.
 */
export const WritesEdge = memo(WritesEdgeComponent);
