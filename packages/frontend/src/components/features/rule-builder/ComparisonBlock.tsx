import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface ComparisonBlockProps {
  /** The comparison operator */
  operator: '==' | '!=' | '===' | '!==' | '>' | '>=' | '<' | '<=';
  /** The left operand */
  left: Block | undefined;
  /** The right operand */
  right: Block | undefined;
  /** Callback when operands change */
  onChange: (left: Block | undefined, right: Block | undefined) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Comparison operator block component (==, !=, >, <, etc.)
 */
export function ComparisonBlock({
  operator,
  left,
  right,
  onChange,
  onDelete,
}: ComparisonBlockProps) {
  const isInvalid = !left || !right;

  let errorMessage = '';
  if (!left) {
    errorMessage = 'Left operand is required';
  } else if (!right) {
    errorMessage = 'Right operand is required';
  }

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
            <BlockRenderer block={left} onChange={(updated) => onChange(updated, right)} />
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
            <BlockRenderer block={right} onChange={(updated) => onChange(left, updated)} />
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
