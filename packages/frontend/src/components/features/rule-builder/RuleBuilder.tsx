/**
 * Props for the RuleBuilder component
 */
export interface RuleBuilderProps {
  /** Initial JSONLogic expression to edit (optional) */
  initialExpression?: object;
  /** Callback when the expression changes */
  onChange?: (expression: object) => void;
  /** Entity type for variable context (e.g., 'Settlement', 'Structure') */
  entityType?: string;
  /** Entity ID for loading current values in live preview */
  entityId?: string;
}

/**
 * Main container component for the visual rule builder.
 * Provides a toggle between visual block-based editing and raw JSON editing.
 *
 * This is a placeholder component for Stage 1 - full implementation in later stages.
 */
export const RuleBuilder = ({
  initialExpression: _initialExpression,
  onChange: _onChange,
  entityType,
  entityId,
}: RuleBuilderProps) => {
  return (
    <div className="rule-builder" data-testid="rule-builder">
      <h2>Rule Builder</h2>
      <p>Visual rule builder coming soon...</p>
      {entityType && <p>Entity Type: {entityType}</p>}
      {entityId && <p>Entity ID: {entityId}</p>}
    </div>
  );
};
