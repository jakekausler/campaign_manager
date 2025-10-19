import type { NodeProps } from '@xyflow/react';
import { Database } from 'lucide-react';
import { memo } from 'react';

import type { FlowNodeData } from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

import { CustomNode } from './CustomNode';

/**
 * VariableNode - Custom node component for state variables.
 *
 * Visual characteristics:
 * - Green background (#22c55e - Tailwind green-500)
 * - Database icon indicating data storage
 * - Darker green border (#16a34a - Tailwind green-600)
 *
 * Represents state variables that store campaign data and can be
 * read/written by conditions and effects.
 */
function VariableNodeComponent(props: NodeProps & { data: FlowNodeData }) {
  return (
    <CustomNode
      {...props}
      icon={Database}
      bgColor={NODE_COLORS.VARIABLE.bg}
      borderColor={NODE_COLORS.VARIABLE.border}
    />
  );
}

/**
 * Memoized VariableNode to prevent unnecessary re-renders.
 */
export const VariableNode = memo(VariableNodeComponent);
