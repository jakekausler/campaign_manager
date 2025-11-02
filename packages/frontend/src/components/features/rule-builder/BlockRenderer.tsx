import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { ArithmeticBlock } from './ArithmeticBlock';
import { ComparisonBlock } from './ComparisonBlock';
import { IfBlock } from './IfBlock';
import { LiteralBlock } from './LiteralBlock';
import { LogicalBlock } from './LogicalBlock';
import { VariableBlock } from './VariableBlock';
import type { Block } from './types';

export interface BlockRendererProps {
  /** The block to render */
  block: Block;
  /** Callback when block is updated */
  onUpdate: (blockId: string, updatedBlock: Block) => void;
  /** Callback when block is deleted */
  onDelete: (blockId: string) => void;
  /** Entity type for context */
  entityType?: string;
  /** Whether this block is nested (disables top-level drag) */
  isNested?: boolean;
}

/**
 * Renders a block with appropriate operator component and drag-and-drop support
 */
export function BlockRenderer({
  block,
  onUpdate,
  onDelete,
  entityType = 'generic',
  isNested = false,
}: BlockRendererProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: isNested, // Nested blocks don't participate in top-level drag-and-drop
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDelete = () => onDelete(block.id);

  // Render appropriate block component based on operator
  const renderBlock = () => {
    switch (block.operator) {
      case 'if':
        return (
          <IfBlock
            block={block}
            onUpdate={(updated) => onUpdate(block.id, updated)}
            onDelete={handleDelete}
            entityType={entityType}
          />
        );

      case 'and':
      case 'or':
      case '!':
        return (
          <LogicalBlock
            block={block}
            onUpdate={(updated) => onUpdate(block.id, updated)}
            onDelete={handleDelete}
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
            onUpdate={(updated) => onUpdate(block.id, updated)}
            onDelete={handleDelete}
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
            onUpdate={(updated) => onUpdate(block.id, updated)}
            onDelete={handleDelete}
            entityType={entityType}
          />
        );

      case 'var':
        return (
          <VariableBlock
            block={block}
            onUpdate={(updated) => onUpdate(block.id, updated)}
            onDelete={handleDelete}
          />
        );

      case 'literal':
        return (
          <LiteralBlock
            block={block}
            onUpdate={(updated) => onUpdate(block.id, updated)}
            onDelete={handleDelete}
          />
        );

      default:
        return (
          <div className="p-3 border border-red-500 bg-red-50 rounded">
            <p className="text-red-700">Unknown operator type</p>
          </div>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`block-${block.id}`}
    >
      {renderBlock()}
    </div>
  );
}
