import type { DependencyNodeType } from '@/services/api/hooks';

/**
 * Route mapping for each node type.
 * These routes will navigate to entity-specific edit pages.
 *
 * Note: Edit pages for conditions, effects, and variables don't exist yet (as of TICKET-021 Stage 9).
 * These route templates are placeholders for future implementation.
 * When edit pages are added, update these paths accordingly.
 */
const NODE_TYPE_ROUTES: Record<DependencyNodeType, string> = {
  VARIABLE: '/variables/:id', // Placeholder - edit page not yet implemented
  CONDITION: '/conditions/:id', // Placeholder - edit page not yet implemented
  EFFECT: '/effects/:id', // Placeholder - edit page not yet implemented
  ENTITY: '/entities/:id', // Placeholder - edit page not yet implemented
};

/**
 * Get the edit route for a specific node type and entity ID.
 *
 * Generates the route path for editing the underlying entity associated with a dependency graph node.
 * The route includes the campaign context to ensure proper scoping.
 *
 * @param nodeType - The type of dependency node (VARIABLE, CONDITION, EFFECT, ENTITY)
 * @param entityId - The unique identifier of the entity to edit
 * @param _campaignId - The campaign ID for context (currently unused but included for future use)
 * @returns The route path string, or null if the node type doesn't support editing
 *
 * @example
 * ```typescript
 * const route = getNodeEditRoute('CONDITION', 'condition-123', 'campaign-456');
 * // Returns: '/conditions/condition-123'
 * ```
 */
export function getNodeEditRoute(
  nodeType: DependencyNodeType,
  entityId: string,
  _campaignId: string
): string | null {
  const routeTemplate = NODE_TYPE_ROUTES[nodeType];

  if (!routeTemplate) {
    return null;
  }

  // Replace :id placeholder with actual entity ID
  return routeTemplate.replace(':id', entityId);
}

/**
 * Get human-readable label for node type.
 * Used for user-facing messages and tooltips.
 */
export function getNodeTypeLabel(nodeType: DependencyNodeType): string {
  const labels: Record<DependencyNodeType, string> = {
    VARIABLE: 'Variable',
    CONDITION: 'Condition',
    EFFECT: 'Effect',
    ENTITY: 'Entity',
  };

  return labels[nodeType] || 'Unknown';
}

/**
 * Check if a node type supports editing.
 * Returns true if edit functionality is available for this node type.
 *
 * Note: Currently returns false for all types since edit pages don't exist yet.
 * Update this function as edit pages are implemented.
 */
export function isNodeEditable(nodeType: DependencyNodeType): boolean {
  // TODO: Enable editing once edit pages are implemented for each type
  // For now, all node types are not editable (edit pages don't exist)
  const editableTypes: DependencyNodeType[] = [];

  return editableTypes.includes(nodeType);
}

/**
 * Get user-friendly message when attempting to edit a node.
 * Returns appropriate message based on whether editing is supported.
 */
export function getNodeEditMessage(
  nodeType: DependencyNodeType,
  entityId: string,
  label: string
): string {
  const typeLabel = getNodeTypeLabel(nodeType);

  if (isNodeEditable(nodeType)) {
    return `Opening ${typeLabel}: ${label}`;
  }

  return `${typeLabel} editing not yet implemented.\n\nNode: ${label}\nID: ${entityId}\n\nEdit functionality will be available in a future update.`;
}
