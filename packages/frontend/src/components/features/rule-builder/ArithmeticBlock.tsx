import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface ArithmeticBlockProps {
  /** The arithmetic operator */
  operator: '+' | '-' | '*' | '/' | '%';
  /** The operands */
  operands: Block[];
  /** Callback when operands change */
  onChange: (operands: Block[]) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Arithmetic operator block component (+, -, *, /, %)
 */
export function ArithmeticBlock({ operator, operands, onChange, onDelete }: ArithmeticBlockProps) {
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
              <BlockRenderer
                block={operand}
                onChange={(updated) => {
                  const newOperands = operands.map((o) => (o.id === updated.id ? updated : o));
                  onChange(newOperands);
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
