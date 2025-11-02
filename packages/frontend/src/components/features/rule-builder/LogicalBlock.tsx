import { NestedBlockRenderer } from './NestedBlockRenderer';
import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface LogicalBlockProps {
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
 * Logical operator block component (AND, OR, NOT)
 */
export function LogicalBlock({ block, onUpdate, onDelete, entityType }: LogicalBlockProps) {
  const operator = block.operator as 'and' | 'or' | '!';
  const children = block.children || [];
  const getLabel = () => {
    switch (operator) {
      case 'and':
        return 'and';
      case 'or':
        return 'or';
      case '!':
        return 'not';
      default:
        return operator;
    }
  };

  const getIcon = () => {
    switch (operator) {
      case 'and':
        return '∧';
      case 'or':
        return '∨';
      case '!':
        return '¬';
      default:
        return '';
    }
  };

  // Validation
  let isInvalid = false;
  let errorMessage = '';

  if (operator === '!' && children.length !== 1) {
    isInvalid = true;
    errorMessage = 'NOT operator requires exactly one child';
  } else if ((operator === 'and' || operator === 'or') && children.length === 0) {
    isInvalid = true;
    errorMessage = 'Logical operator requires at least one child';
  }

  const handleChildUpdate = (index: number, updated: Block) => {
    const newChildren = [...children];
    newChildren[index] = updated;
    onUpdate({ ...block, children: newChildren });
  };

  const handleChildDelete = (index: number) => {
    const newChildren = children.filter((_, i) => i !== index);
    onUpdate({ ...block, children: newChildren });
  };

  return (
    <OperatorBlock
      operator={operator}
      type="logical"
      label={getLabel()}
      icon={getIcon()}
      invalid={isInvalid}
      errorMessage={errorMessage}
      onDelete={onDelete}
    >
      <div className="space-y-2">
        {children.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
            Add condition...
          </div>
        ) : (
          children.map((child, index) => (
            <div key={child.id} className="relative">
              {index > 0 && (
                <div className="text-xs font-semibold text-purple-600 uppercase mb-1">
                  {getLabel()}
                </div>
              )}
              <NestedBlockRenderer
                block={child}
                onUpdate={(updated) => handleChildUpdate(index, updated)}
                onDelete={() => handleChildDelete(index)}
                entityType={entityType}
              />
            </div>
          ))
        )}
      </div>
    </OperatorBlock>
  );
}
