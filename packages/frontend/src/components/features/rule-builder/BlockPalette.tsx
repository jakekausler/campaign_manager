import { Button } from '@/components/ui/button';

import { generateId } from './helpers';
import type { Block, LiteralValue } from './types';

export interface BlockPaletteProps {
  /** Callback when a new block is added */
  onAddBlock: (block: Block) => void;
  /** Entity type for context */
  entityType?: string;
}

/**
 * Palette of available block types that can be added to the rule builder
 */
export function BlockPalette({ onAddBlock, entityType: _entityType }: BlockPaletteProps) {
  const createBlock = (
    operator: Block['operator'],
    type: Block['type'],
    value?: LiteralValue | string,
    children?: Block[]
  ): Block => ({
    id: generateId(),
    type,
    operator,
    value,
    children,
  });

  const blockTypes = [
    {
      category: 'Conditional',
      blocks: [
        {
          label: 'If-Then-Else',
          description: 'Conditional expression',
          icon: '🔀',
          onClick: () =>
            onAddBlock(
              createBlock('if', 'conditional', undefined, [
                createBlock('literal', 'literal', true),
                createBlock('literal', 'literal', 'then value'),
                createBlock('literal', 'literal', 'else value'),
              ])
            ),
        },
      ],
    },
    {
      category: 'Logical',
      blocks: [
        {
          label: 'AND',
          description: 'All conditions must be true',
          icon: '∧',
          onClick: () =>
            onAddBlock(
              createBlock('and', 'logical', undefined, [
                createBlock('literal', 'literal', true),
                createBlock('literal', 'literal', true),
              ])
            ),
        },
        {
          label: 'OR',
          description: 'At least one condition must be true',
          icon: '∨',
          onClick: () =>
            onAddBlock(
              createBlock('or', 'logical', undefined, [
                createBlock('literal', 'literal', true),
                createBlock('literal', 'literal', false),
              ])
            ),
        },
        {
          label: 'NOT',
          description: 'Negates the condition',
          icon: '¬',
          onClick: () =>
            onAddBlock(
              createBlock('!', 'logical', undefined, [createBlock('literal', 'literal', true)])
            ),
        },
      ],
    },
    {
      category: 'Comparison',
      blocks: [
        {
          label: 'Equal (==)',
          description: 'Check if values are equal',
          icon: '=',
          onClick: () =>
            onAddBlock(
              createBlock('==', 'comparison', undefined, [
                createBlock('literal', 'literal', 1),
                createBlock('literal', 'literal', 1),
              ])
            ),
        },
        {
          label: 'Not Equal (!=)',
          description: 'Check if values are not equal',
          icon: '≠',
          onClick: () =>
            onAddBlock(
              createBlock('!=', 'comparison', undefined, [
                createBlock('literal', 'literal', 1),
                createBlock('literal', 'literal', 2),
              ])
            ),
        },
        {
          label: 'Greater Than (>)',
          description: 'Check if left is greater than right',
          icon: '>',
          onClick: () =>
            onAddBlock(
              createBlock('>', 'comparison', undefined, [
                createBlock('literal', 'literal', 2),
                createBlock('literal', 'literal', 1),
              ])
            ),
        },
        {
          label: 'Greater or Equal (>=)',
          description: 'Check if left is greater than or equal to right',
          icon: '≥',
          onClick: () =>
            onAddBlock(
              createBlock('>=', 'comparison', undefined, [
                createBlock('literal', 'literal', 2),
                createBlock('literal', 'literal', 1),
              ])
            ),
        },
        {
          label: 'Less Than (<)',
          description: 'Check if left is less than right',
          icon: '<',
          onClick: () =>
            onAddBlock(
              createBlock('<', 'comparison', undefined, [
                createBlock('literal', 'literal', 1),
                createBlock('literal', 'literal', 2),
              ])
            ),
        },
        {
          label: 'Less or Equal (<=)',
          description: 'Check if left is less than or equal to right',
          icon: '≤',
          onClick: () =>
            onAddBlock(
              createBlock('<=', 'comparison', undefined, [
                createBlock('literal', 'literal', 1),
                createBlock('literal', 'literal', 2),
              ])
            ),
        },
      ],
    },
    {
      category: 'Arithmetic',
      blocks: [
        {
          label: 'Add (+)',
          description: 'Add numbers together',
          icon: '+',
          onClick: () =>
            onAddBlock(
              createBlock('+', 'arithmetic', undefined, [
                createBlock('literal', 'literal', 1),
                createBlock('literal', 'literal', 2),
              ])
            ),
        },
        {
          label: 'Subtract (-)',
          description: 'Subtract second from first',
          icon: '−',
          onClick: () =>
            onAddBlock(
              createBlock('-', 'arithmetic', undefined, [
                createBlock('literal', 'literal', 5),
                createBlock('literal', 'literal', 3),
              ])
            ),
        },
        {
          label: 'Multiply (*)',
          description: 'Multiply numbers together',
          icon: '×',
          onClick: () =>
            onAddBlock(
              createBlock('*', 'arithmetic', undefined, [
                createBlock('literal', 'literal', 2),
                createBlock('literal', 'literal', 3),
              ])
            ),
        },
        {
          label: 'Divide (/)',
          description: 'Divide first by second',
          icon: '÷',
          onClick: () =>
            onAddBlock(
              createBlock('/', 'arithmetic', undefined, [
                createBlock('literal', 'literal', 10),
                createBlock('literal', 'literal', 2),
              ])
            ),
        },
        {
          label: 'Modulo (%)',
          description: 'Remainder after division',
          icon: '%',
          onClick: () =>
            onAddBlock(
              createBlock('%', 'arithmetic', undefined, [
                createBlock('literal', 'literal', 10),
                createBlock('literal', 'literal', 3),
              ])
            ),
        },
      ],
    },
    {
      category: 'Values',
      blocks: [
        {
          label: 'Variable',
          description: 'Reference a variable from context',
          icon: '🔢',
          onClick: () => onAddBlock(createBlock('var', 'variable', 'path.to.variable')),
        },
        {
          label: 'Number',
          description: 'Constant number value',
          icon: '123',
          onClick: () => onAddBlock(createBlock('literal', 'literal', 0)),
        },
        {
          label: 'Text',
          description: 'Constant text value',
          icon: '"',
          onClick: () => onAddBlock(createBlock('literal', 'literal', '')),
        },
        {
          label: 'Boolean',
          description: 'True or false value',
          icon: '✓/✗',
          onClick: () => onAddBlock(createBlock('literal', 'literal', true)),
        },
        {
          label: 'Null',
          description: 'Empty value',
          icon: '∅',
          onClick: () => onAddBlock(createBlock('literal', 'literal', null)),
        },
      ],
    },
  ];

  return (
    <div
      className="border rounded-lg p-4 bg-gray-50 space-y-4"
      data-testid="block-palette"
      role="region"
      aria-label="Block Palette"
    >
      {blockTypes.map((category) => (
        <div key={category.category}>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">{category.category}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {category.blocks.map((block) => (
              <Button
                key={block.label}
                onClick={block.onClick}
                variant="outline"
                size="sm"
                className="flex flex-col items-center justify-center h-auto py-2 px-3 text-xs"
                title={block.description}
                data-testid={`add-${block.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              >
                <span className="text-xl mb-1">{block.icon}</span>
                <span className="font-medium">{block.label}</span>
              </Button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
