import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface LogicalBlockProps {
  /** The logical operator (and, or, !) */
  operator: 'and' | 'or' | '!';
  /** The child condition blocks */
  children: Block[];
  /** Callback when children change */
  onChange: (children: Block[]) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Logical operator block component (AND, OR, NOT)
 */
export function LogicalBlock({ operator, children, onChange, onDelete }: LogicalBlockProps) {
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
              <BlockRenderer
                block={child}
                onChange={(updated) => {
                  const newChildren = children.map((c) => (c.id === updated.id ? updated : c));
                  onChange(newChildren);
                }}
              />
            </div>
          ))
        )}
      </div>
    </OperatorBlock>
  );
}

/**
 * Helper component to render a block recursively
 * This is a placeholder that will be replaced with the actual BlockRenderer in Stage 5
 */
function BlockRenderer({ block, onChange }: { block: Block; onChange: (block: Block) => void }) {
  // For now, just render a simple representation
  // This will be replaced with proper block rendering in later stages
  return (
    <div className="text-sm p-2 bg-white border border-gray-200 rounded">
      <span className="font-mono text-xs text-gray-600">{block.operator}</span>
      {block.value !== undefined && (
        <span className="ml-2 text-gray-800">{String(block.value)}</span>
      )}
      {block.children && block.children.length > 0 && (
        <div className="ml-4 mt-2 space-y-1">
          {block.children.map((child) => (
            <BlockRenderer
              key={child.id}
              block={child}
              onChange={(updated) => {
                // Update the child in the parent's children array
                const newChildren = block.children?.map((c) => (c.id === updated.id ? updated : c));
                onChange({ ...block, children: newChildren });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
