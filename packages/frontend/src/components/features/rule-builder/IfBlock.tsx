import { NestedBlockRenderer } from './NestedBlockRenderer';
import { OperatorBlock } from './OperatorBlock';
import { generateId } from './helpers';
import type { Block } from './types';

export interface IfBlockProps {
  /** The complete if block */
  block: Block;
  /** Callback when the block structure changes */
  onUpdate: (updated: Block) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
  /** Entity type for context */
  entityType?: string;
}

/**
 * If-then-else conditional block component
 * Structure: if (condition) then (thenValue) else (elseValue)
 */
export function IfBlock({ block, onUpdate, onDelete, entityType }: IfBlockProps) {
  const [condition, thenValue, elseValue] = block.children || [];
  const isInvalid = !condition || !thenValue || !elseValue;

  let errorMessage = '';
  if (!condition) {
    errorMessage = 'Condition is required';
  } else if (!thenValue) {
    errorMessage = 'Then value is required';
  } else if (!elseValue) {
    errorMessage = 'Else value is required';
  }

  const handleChildUpdate = (index: number, updated: Block) => {
    const newChildren = [...(block.children || [])];
    newChildren[index] = updated;
    onUpdate({ ...block, children: newChildren });
  };

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
              <NestedBlockRenderer
                block={condition}
                onUpdate={(updated) => handleChildUpdate(0, updated)}
                onDelete={() => {
                  const newChildren = [...(block.children || [])];
                  newChildren[0] = {
                    id: generateId(),
                    type: 'literal',
                    operator: 'literal',
                    value: true,
                  };
                  onUpdate({ ...block, children: newChildren });
                }}
                entityType={entityType}
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
              <NestedBlockRenderer
                block={thenValue}
                onUpdate={(updated) => handleChildUpdate(1, updated)}
                onDelete={() => {
                  const newChildren = [...(block.children || [])];
                  newChildren[1] = {
                    id: generateId(),
                    type: 'literal',
                    operator: 'literal',
                    value: null,
                  };
                  onUpdate({ ...block, children: newChildren });
                }}
                entityType={entityType}
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
              <NestedBlockRenderer
                block={elseValue}
                onUpdate={(updated) => handleChildUpdate(2, updated)}
                onDelete={() => {
                  const newChildren = [...(block.children || [])];
                  newChildren[2] = {
                    id: generateId(),
                    type: 'literal',
                    operator: 'literal',
                    value: null,
                  };
                  onUpdate({ ...block, children: newChildren });
                }}
                entityType={entityType}
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
