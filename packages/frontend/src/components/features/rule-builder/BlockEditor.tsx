import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useState, useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';

import { BlockPalette } from './BlockPalette';
import { BlockRenderer } from './BlockRenderer';
import { parseExpression, serializeBlocks } from './helpers';
import type { Block, JSONLogicExpression } from './types';

/**
 * Props for the BlockEditor component
 */
export interface BlockEditorProps {
  /** JSONLogic expression represented as blocks */
  expression?: JSONLogicExpression;
  /** Callback when blocks are modified */
  onChange?: (expression: JSONLogicExpression) => void;
  /** Entity type for variable picker context */
  entityType?: string;
}

/**
 * Visual block-based editing interface for JSONLogic expressions.
 * Supports drag-and-drop reordering and nested block structures.
 */
export const BlockEditor = ({ expression, onChange, entityType = 'generic' }: BlockEditorProps) => {
  // Parse initial expression into blocks
  const initialBlocks = useMemo(() => {
    if (!expression) return [];
    return parseExpression(expression as JSONLogicExpression);
  }, [expression]);

  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Setup drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle block modifications
  const handleBlocksChange = useCallback(
    (newBlocks: Block[]) => {
      setBlocks(newBlocks);
      if (onChange) {
        // Serialize blocks back to JSONLogic
        const serialized = serializeBlocks(newBlocks);
        onChange(serialized);
      }
    },
    [onChange]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(blocks, oldIndex, newIndex);
          handleBlocksChange(reordered);
        }
      }
    },
    [blocks, handleBlocksChange]
  );

  // Handle block update
  const handleBlockUpdate = useCallback(
    (blockId: string, updatedBlock: Block) => {
      const updateBlockRecursive = (blocksList: Block[]): Block[] => {
        return blocksList.map((block) => {
          if (block.id === blockId) {
            return updatedBlock;
          }
          if (block.children) {
            return {
              ...block,
              children: updateBlockRecursive(block.children),
            };
          }
          return block;
        });
      };

      handleBlocksChange(updateBlockRecursive(blocks));
    },
    [blocks, handleBlocksChange]
  );

  // Handle block deletion
  const handleBlockDelete = useCallback(
    (blockId: string) => {
      const deleteBlockRecursive = (blocksList: Block[]): Block[] => {
        return blocksList
          .filter((block) => block.id !== blockId)
          .map((block) => {
            if (block.children) {
              return {
                ...block,
                children: deleteBlockRecursive(block.children),
              };
            }
            return block;
          });
      };

      handleBlocksChange(deleteBlockRecursive(blocks));
    },
    [blocks, handleBlocksChange]
  );

  // Handle adding a new block from palette
  const handleAddBlock = useCallback(
    (newBlock: Block) => {
      handleBlocksChange([...blocks, newBlock]);
      setIsPaletteOpen(false);
    },
    [blocks, handleBlocksChange]
  );

  return (
    <div className="block-editor space-y-4" data-testid="block-editor">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Visual Rule Builder</h3>
        <Button
          onClick={() => setIsPaletteOpen(!isPaletteOpen)}
          variant="outline"
          size="sm"
          aria-label="Add new block"
          data-testid="add-block-button"
        >
          {isPaletteOpen ? 'Close Palette' : '+ Add Block'}
        </Button>
      </div>

      {/* Block Palette */}
      {isPaletteOpen && <BlockPalette onAddBlock={handleAddBlock} entityType={entityType} />}

      {/* Blocks Area */}
      {blocks.length === 0 ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500"
          data-testid="empty-state"
        >
          <p>No blocks yet. Click &quot;+ Add Block&quot; to get started.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3" data-testid="blocks-container">
              {blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  onUpdate={handleBlockUpdate}
                  onDelete={handleBlockDelete}
                  entityType={entityType}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
