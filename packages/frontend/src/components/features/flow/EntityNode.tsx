import type { NodeProps } from '@xyflow/react';
import { Box } from 'lucide-react';
import { memo } from 'react';

import type { FlowNodeData } from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

import { CustomNode } from './CustomNode';

/**
 * EntityNode - Custom node component for game entities.
 *
 * Visual characteristics:
 * - Purple background (#a855f7 - Tailwind purple-500)
 * - Box icon indicating game objects/entities
 * - Darker purple border (#9333ea - Tailwind purple-600)
 *
 * Represents game entities (settlements, structures, locations, characters,
 * events, encounters) that have computed fields and participate in dependencies.
 */
function EntityNodeComponent(props: NodeProps & { data: FlowNodeData }) {
  return (
    <CustomNode
      {...props}
      icon={Box}
      bgColor={NODE_COLORS.ENTITY.bg}
      borderColor={NODE_COLORS.ENTITY.border}
    />
  );
}

/**
 * Memoized EntityNode to prevent unnecessary re-renders.
 */
export const EntityNode = memo(EntityNodeComponent);
