import { Input } from '@/components/ui/input';

import { OperatorBlock } from './OperatorBlock';
import type { LiteralValue } from './types';

export interface LiteralBlockProps {
  /** The literal value */
  value: LiteralValue;
  /** Callback when value changes */
  onChange: (value: LiteralValue) => void;
  /** Callback when delete button is clicked */
  onDelete?: () => void;
}

/**
 * Literal value block component (string, number, boolean, null)
 */
export function LiteralBlock({ value, onChange, onDelete }: LiteralBlockProps) {
  const getValueType = (): 'string' | 'number' | 'boolean' | 'null' => {
    if (value === null) return 'null';
    return typeof value as 'string' | 'number' | 'boolean';
  };

  const handleInputChange = (newValue: string) => {
    const valueType = getValueType();

    switch (valueType) {
      case 'number':
        onChange(parseFloat(newValue) || 0);
        break;
      case 'boolean':
        onChange(newValue === 'true');
        break;
      case 'null':
        onChange(null);
        break;
      case 'string':
      default:
        onChange(newValue);
    }
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
              onChange={(e) => onChange(e.target.value === 'true')}
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
