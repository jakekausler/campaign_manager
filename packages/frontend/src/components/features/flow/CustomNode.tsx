import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import { memo } from 'react';

import { cn } from '@/lib/utils';
import type { FlowNodeData } from '@/utils';

export type CustomNodeProps = NodeProps & {
  data: FlowNodeData;
  icon: LucideIcon;
  bgColor: string;
  borderColor: string;
};

/**
 * Base custom node component for dependency graph visualization.
 *
 * Features:
 * - Icon and label display
 * - Hover and selection states
 * - Connection handles (top and bottom)
 * - Consistent sizing (180x60px)
 * - Accessible with proper ARIA labels
 *
 * Used as the foundation for all node types (Variable, Condition, Effect, Entity).
 */
function CustomNodeComponent({
  data,
  selected,
  icon: Icon,
  bgColor,
  borderColor,
}: CustomNodeProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg shadow-md border-2 transition-all',
        'hover:shadow-lg hover:scale-105',
        'flex items-center gap-3',
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
      style={{
        backgroundColor: bgColor,
        borderColor: selected ? '#3b82f6' : borderColor,
        width: '180px',
        minHeight: '60px',
      }}
      role="button"
      tabIndex={0}
      aria-label={`${data.nodeType} node: ${data.label}`}
    >
      {/* Top handle for incoming connections */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
        aria-label="Connection point for incoming edges"
      />

      {/* Icon */}
      <div className="flex-shrink-0">
        <Icon className="w-6 h-6 text-white" aria-hidden="true" />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate" title={data.label}>
          {data.label}
        </div>
        <div className="text-xs text-white/80 truncate" title={data.nodeType}>
          {data.nodeType}
        </div>
      </div>

      {/* Bottom handle for outgoing connections */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-white"
        aria-label="Connection point for outgoing edges"
      />
    </div>
  );
}

/**
 * Memoized custom node component to prevent unnecessary re-renders.
 * Only re-renders when props change (selected state, data, etc.).
 */
export const CustomNode = memo(CustomNodeComponent);
