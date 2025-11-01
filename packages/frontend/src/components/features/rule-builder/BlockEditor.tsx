/**
 * Props for the BlockEditor component
 */
export interface BlockEditorProps {
  /** JSONLogic expression represented as blocks */
  expression?: object;
  /** Callback when blocks are modified */
  onChange?: (expression: object) => void;
  /** Entity type for variable picker context */
  entityType?: string;
}

/**
 * Visual block-based editing interface for JSONLogic expressions.
 * Supports drag-and-drop reordering and nested block structures.
 *
 * This is a placeholder component for Stage 1 - full implementation in later stages.
 */
export const BlockEditor = ({
  expression: _expression,
  onChange: _onChange,
  entityType,
}: BlockEditorProps) => {
  return (
    <div className="block-editor" data-testid="block-editor">
      <h3>Block Editor</h3>
      <p>Drag-and-drop block editor coming soon...</p>
      {entityType && <p>Context: {entityType}</p>}
    </div>
  );
};
