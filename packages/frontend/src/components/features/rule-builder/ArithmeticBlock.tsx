import { NestedBlockRenderer } from './NestedBlockRenderer';
import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface ArithmeticBlockProps {
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
 * Arithmetic operator block component (+, -, *, /, %)
 */
export function ArithmeticBlock({ block, onUpdate, onDelete, entityType }: ArithmeticBlockProps) {
  const operator = block.operator as '+' | '-' | '*' | '/' | '%';
  const operands = block.children || [];
  const isInvalid = operands.length < 2;
  const errorMessage = isInvalid ? 'Arithmetic operator requires at least two operands' : '';

  const getLabel = () => {
    switch (operator) {
      case '+':
        return 'add';
      case '-':
        return 'subtract';
      case '*':
        return 'multiply';
      case '/':
        return 'divide';
      case '%':
        return 'modulo';
      default:
        return operator;
    }
  };

  const handleChildUpdate = (index: number, updated: Block) => {
    const newChildren = [...operands];
    newChildren[index] = updated;
    onUpdate({ ...block, children: newChildren });
  };

  const handleChildDelete = (index: number) => {
    const newChildren = operands.filter((_, i) => i !== index);
    onUpdate({ ...block, children: newChildren });
  };

  return (
    <OperatorBlock
      operator={operator}
      type="arithmetic"
      label={getLabel()}
      invalid={isInvalid}
      errorMessage={errorMessage}
      onDelete={onDelete}
    >
      <div className="space-y-2">
        {operands.length === 0 ? (
          <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
            Add operands...
          </div>
        ) : (
          operands.map((operand, index) => (
            <div key={operand.id} className="relative">
              {index > 0 && (
                <div className="text-xs font-semibold text-green-600 uppercase mb-1">
                  {operator}
                </div>
              )}
              <NestedBlockRenderer
                block={operand}
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
