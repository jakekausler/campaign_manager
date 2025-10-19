import type { NodeProps } from '@xyflow/react';
import { Zap } from 'lucide-react';
import { memo } from 'react';

import type { FlowNodeData } from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

import { CustomNode } from './CustomNode';

/**
 * EffectNode - Custom node component for effects.
 *
 * Visual characteristics:
 * - Orange background (#f97316 - Tailwind orange-500)
 * - Zap/lightning icon indicating actions/side effects
 * - Darker orange border (#ea580c - Tailwind orange-600)
 *
 * Represents effects that execute when events/encounters resolve,
 * applying JSON Patch operations to mutate world state and write to variables.
 */
function EffectNodeComponent(props: NodeProps & { data: FlowNodeData }) {
  return (
    <CustomNode
      {...props}
      icon={Zap}
      bgColor={NODE_COLORS.EFFECT.bg}
      borderColor={NODE_COLORS.EFFECT.border}
    />
  );
}

/**
 * Memoized EffectNode to prevent unnecessary re-renders.
 */
export const EffectNode = memo(EffectNodeComponent);
