import { generateShortId } from '@/utils';

import { NestedBlockRenderer } from './NestedBlockRenderer';
import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface ComparisonBlockProps {
  /** The complete block */
  block: Block;
  /** Callback when the block structure changes */
  onUpdate: (updated: Block) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
  /** Entity type for context (optional, for blocks that need it) */
  entityType?: string;
}

/**
 * Comparison operator block component (==, !=, >, <, etc.)
 */
export function ComparisonBlock({ block, onUpdate, onDelete, entityType }: ComparisonBlockProps) {
  const operator = block.operator as '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=';
  const [left, right] = block.children || [];
  const isInvalid = !left || !right;

  let errorMessage = '';
  if (!left) {
    errorMessage = 'Left operand is required';
  } else if (!right) {
    errorMessage = 'Right operand is required';
  }

  const handleChildUpdate = (index: number, updated: Block) => {
    const newChildren = [...(block.children || [])];
    newChildren[index] = updated;
    onUpdate({ ...block, children: newChildren });
  };

  const handleChildDelete = (index: number) => {
    const newChildren = [...(block.children || [])];
    newChildren[index] = {
      id: generateShortId(),
      type: 'literal',
      operator: 'literal',
      value: null,
    };
    onUpdate({ ...block, children: newChildren });
  };

  return (
    <OperatorBlock
      operator={operator}
      type="comparison"
      invalid={isInvalid}
      errorMessage={errorMessage}
      onDelete={onDelete}
    >
      <div className="flex items-center gap-3">
        {/* Left operand */}
        <div className="flex-1">
          {left ? (
            <NestedBlockRenderer
              block={left}
              onUpdate={(updated) => handleChildUpdate(0, updated)}
              onDelete={() => handleChildDelete(0)}
              entityType={entityType}
            />
          ) : (
            <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
              Add left operand...
            </div>
          )}
        </div>

        {/* Operator */}
        <div className="text-lg font-bold text-blue-600">{operator}</div>

        {/* Right operand */}
        <div className="flex-1">
          {right ? (
            <NestedBlockRenderer
              block={right}
              onUpdate={(updated) => handleChildUpdate(1, updated)}
              onDelete={() => handleChildDelete(1)}
              entityType={entityType}
            />
          ) : (
            <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
              Add right operand...
            </div>
          )}
        </div>
      </div>
    </OperatorBlock>
  );
}
