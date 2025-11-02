import { Input } from '@/components/ui/input';

import { OperatorBlock } from './OperatorBlock';
import type { Block, LiteralValue } from './types';

export interface LiteralBlockProps {
  /** The complete block */
  block: Block;
  /** Callback when the block structure changes */
  onUpdate: (updated: Block) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Literal value block component (string, number, boolean, null)
 */
export function LiteralBlock({ block, onUpdate, onDelete }: LiteralBlockProps) {
  const value = block.value as LiteralValue;

  const getValueType = (): 'string' | 'number' | 'boolean' | 'null' => {
    if (value === null) return 'null';
    return typeof value as 'string' | 'number' | 'boolean';
  };

  const handleInputChange = (newValue: string) => {
    const valueType = getValueType();

    let updatedValue: LiteralValue;
    switch (valueType) {
      case 'number':
        updatedValue = parseFloat(newValue) || 0;
        break;
      case 'boolean':
        updatedValue = newValue === 'true';
        break;
      case 'null':
        updatedValue = null;
        break;
      case 'string':
      default:
        updatedValue = newValue;
    }

    onUpdate({ ...block, value: updatedValue });
  };

  const handleBooleanChange = (newValue: boolean) => {
    onUpdate({ ...block, value: newValue });
  };

  return (
    <OperatorBlock
      operator="literal"
      type="literal"
      label={`literal (${getValueType()})`}
      icon="📝"
      onDelete={onDelete}
      collapsible={false}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Value:</span>
          {getValueType() === 'boolean' ? (
            <select
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
              value={String(value)}
              onChange={(e) => handleBooleanChange(e.target.value === 'true')}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : getValueType() === 'null' ? (
            <Input type="text" value="null" disabled className="flex-1" />
          ) : (
            <Input
              type={getValueType() === 'number' ? 'number' : 'text'}
              value={String(value)}
              onChange={(e) => handleInputChange(e.target.value)}
              className="flex-1"
            />
          )}
        </div>
      </div>
    </OperatorBlock>
  );
}
