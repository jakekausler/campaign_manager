import { ArithmeticBlock } from './ArithmeticBlock';
import { ComparisonBlock } from './ComparisonBlock';
import { IfBlock } from './IfBlock';
import { LiteralBlock } from './LiteralBlock';
import { LogicalBlock } from './LogicalBlock';
import { VariableBlock } from './VariableBlock';
import type { Block } from './types';

export interface NestedBlockRendererProps {
  /** The block to render */
  block: Block;
  /** Callback when block is updated */
  onUpdate: (updatedBlock: Block) => void;
  /** Callback when block is deleted */
  onDelete: () => void;
  /** Entity type for context */
  entityType?: string;
}

/**
 * Renders a nested block without drag-and-drop functionality
 * Used for blocks that are children of other blocks (e.g., inside IF blocks)
 */
export function NestedBlockRenderer({
  block,
  onUpdate,
  onDelete,
  entityType = 'generic',
}: NestedBlockRendererProps) {
  // Render appropriate block component based on operator
  switch (block.operator) {
    case 'if':
      return (
        <IfBlock block={block} onUpdate={onUpdate} onDelete={onDelete} entityType={entityType} />
      );

    case 'and':
    case 'or':
    case '!':
      return (
        <LogicalBlock
          block={block}
          onUpdate={onUpdate}
          onDelete={onDelete}
          entityType={entityType}
        />
      );

    case '==':
    case '!=':
    case '===':
    case '!==':
    case '>':
    case '>=':
    case '<':
    case '<=':
      return (
        <ComparisonBlock
          block={block}
          onUpdate={onUpdate}
          onDelete={onDelete}
          entityType={entityType}
        />
      );

    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
      return (
        <ArithmeticBlock
          block={block}
          onUpdate={onUpdate}
          onDelete={onDelete}
          entityType={entityType}
        />
      );

    case 'var':
      return <VariableBlock block={block} onUpdate={onUpdate} onDelete={onDelete} />;

    case 'literal':
      return <LiteralBlock block={block} onUpdate={onUpdate} onDelete={onDelete} />;

    default:
      return (
        <div className="p-3 border border-red-500 bg-red-50 rounded">
          <p className="text-red-700">Unknown operator type</p>
        </div>
      );
  }
}
