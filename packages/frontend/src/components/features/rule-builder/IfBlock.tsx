import { OperatorBlock } from './OperatorBlock';
import type { Block } from './types';

export interface IfBlockProps {
  /** The condition block */
  condition: Block | undefined;
  /** The then value block */
  thenValue: Block | undefined;
  /** The else value block */
  elseValue: Block | undefined;
  /** Callback when the block structure changes */
  onChange: (
    condition: Block | undefined,
    thenValue: Block | undefined,
    elseValue: Block | undefined
  ) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * If-then-else conditional block component
 * Structure: if (condition) then (thenValue) else (elseValue)
 */
export function IfBlock({ condition, thenValue, elseValue, onChange, onDelete }: IfBlockProps) {
  const isInvalid = !condition || !thenValue || !elseValue;

  let errorMessage = '';
  if (!condition) {
    errorMessage = 'Condition is required';
  } else if (!thenValue) {
    errorMessage = 'Then value is required';
  } else if (!elseValue) {
    errorMessage = 'Else value is required';
  }

  return (
    <OperatorBlock
      operator="if"
      type="conditional"
      icon="🔀"
      label="if"
      invalid={isInvalid}
      errorMessage={errorMessage}
      onDelete={onDelete}
    >
      <div className="space-y-3">
        {/* Condition */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-1">Condition:</div>
          <div className="pl-2 border-l-2 border-gray-300">
            {condition ? (
              <BlockRenderer
                block={condition}
                onChange={(updated) => onChange(updated, thenValue, elseValue)}
              />
            ) : (
              <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
                Add condition...
              </div>
            )}
          </div>
        </div>

        {/* Then */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-1">Then:</div>
          <div className="pl-2 border-l-2 border-gray-300">
            {thenValue ? (
              <BlockRenderer
                block={thenValue}
                onChange={(updated) => onChange(condition, updated, elseValue)}
              />
            ) : (
              <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
                Add then value...
              </div>
            )}
          </div>
        </div>

        {/* Else */}
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-1">Else:</div>
          <div className="pl-2 border-l-2 border-gray-300">
            {elseValue ? (
              <BlockRenderer
                block={elseValue}
                onChange={(updated) => onChange(condition, thenValue, updated)}
              />
            ) : (
              <div className="text-sm text-gray-500 italic p-2 bg-gray-100 rounded">
                Add else value...
              </div>
            )}
          </div>
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
