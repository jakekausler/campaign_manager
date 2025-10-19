import type { NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import { memo } from 'react';

import type { FlowNodeData } from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

import { CustomNode } from './CustomNode';

/**
 * ConditionNode - Custom node component for field conditions.
 *
 * Visual characteristics:
 * - Blue background (#3b82f6 - Tailwind blue-500)
 * - GitBranch icon indicating conditional logic/branching
 * - Darker blue border (#2563eb - Tailwind blue-600)
 *
 * Represents conditions that evaluate JSONLogic expressions,
 * read variables, and compute derived fields for entities.
 */
function ConditionNodeComponent(props: NodeProps & { data: FlowNodeData }) {
  return (
    <CustomNode
      {...props}
      icon={GitBranch}
      bgColor={NODE_COLORS.CONDITION.bg}
      borderColor={NODE_COLORS.CONDITION.border}
    />
  );
}

/**
 * Memoized ConditionNode to prevent unnecessary re-renders.
 */
export const ConditionNode = memo(ConditionNodeComponent);
