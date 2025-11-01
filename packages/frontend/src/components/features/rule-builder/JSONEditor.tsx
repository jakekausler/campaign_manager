/**
 * Props for the JSONEditor component
 */
export interface JSONEditorProps {
  /** JSONLogic expression as a JavaScript object */
  expression?: object;
  /** Callback when the JSON is modified */
  onChange?: (expression: object) => void;
  /** Whether the editor is in read-only mode */
  readOnly?: boolean;
}

/**
 * Raw JSON editing interface for JSONLogic expressions.
 * Provides syntax highlighting and validation for manual JSON editing.
 *
 * This is a placeholder component for Stage 1 - full implementation in later stages.
 */
export const JSONEditor = ({
  expression,
  onChange: _onChange,
  readOnly = false,
}: JSONEditorProps) => {
  return (
    <div className="json-editor" data-testid="json-editor">
      <h3>JSON Editor</h3>
      <p>Raw JSON editor coming soon...</p>
      {readOnly && <p>Mode: Read-only</p>}
      {expression && <pre className="json-preview">{JSON.stringify(expression, null, 2)}</pre>}
    </div>
  );
};
