import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import type { ReactNode } from 'react';
import { memo } from 'react';

export type CustomEdgeProps = EdgeProps & {
  strokeColor?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  animated?: boolean;
  label?: ReactNode;
};

/**
 * Base custom edge component for dependency graph visualization.
 *
 * Features:
 * - Smooth step path for better readability
 * - Customizable stroke color, width, and dash pattern
 * - Optional label display
 * - Hover effects for better interactivity
 * - Arrow marker at the end
 * - Animation support for active edges
 *
 * Used as the foundation for all edge types (Reads, Writes, DependsOn).
 */
function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  strokeColor = '#64748b',
  strokeWidth = 2,
  strokeDasharray,
  animated = false,
  label,
  markerEnd,
}: CustomEdgeProps) {
  // Calculate the smooth step path
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* The actual edge path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
        }}
      />

      {/* Optional label rendered separately to avoid path interference */}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="bg-background border rounded px-2 py-1 text-xs font-medium shadow-sm"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Animation overlay for animated edges */}
      {animated && (
        <path
          d={edgePath}
          className="react-flow__edge-path"
          style={{
            stroke: strokeColor,
            strokeWidth,
            strokeDasharray: '5, 5',
            animation: 'dashdraw 0.5s linear infinite',
            opacity: 0.6,
          }}
        />
      )}
    </>
  );
}

/**
 * Memoized custom edge component to prevent unnecessary re-renders.
 * Only re-renders when props change (path coordinates, style, etc.).
 */
export const CustomEdge = memo(CustomEdgeComponent);
