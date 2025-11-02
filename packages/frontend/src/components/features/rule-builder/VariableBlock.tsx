import { Badge } from '@/components/ui/badge';

import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface VariableBlockProps {
  /** The complete block */
  block: Block;
  /** Callback when the block structure changes */
  onUpdate: (updated: Block) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Variable reference block component
 * Displays a reference to a variable in the context
 */
export function VariableBlock({ block, onDelete }: VariableBlockProps) {
  const variablePath = block.value as string;

  return (
    <OperatorBlock
      operator="var"
      type="variable"
      label="variable"
      icon="🔢"
      onDelete={onDelete}
      collapsible={false}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Path:</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {variablePath}
          </Badge>
        </div>
      </div>
    </OperatorBlock>
  );
}
