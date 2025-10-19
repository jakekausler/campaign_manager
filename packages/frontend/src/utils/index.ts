/**
 * Barrel export for utility functions
 *
 * Utilities are pure, stateless functions that perform common operations.
 * Import from this file to use utility functions throughout the app.
 */

// Export utility functions here as they are created
// Example:
// export { formatDate, parseDate, addDays } from './date';
// export { validateEmail, validatePassword } from './validation';
// export { capitalize, truncate, slugify } from './string';
// export { clamp, random, roundTo } from './math';

// Graph layout utilities for React Flow dependency visualization
export {
  transformGraphToFlow,
  transformNode,
  transformEdge,
  applyAutoLayout,
  type FlowNodeData,
  type FlowEdgeData,
  type TransformedGraphData,
} from './graph-layout';

// Node color constants for dependency graph visualization
export { NODE_COLORS } from './node-colors';

// Graph selection utilities for dependency graph highlighting
export {
  calculateSelectionState,
  getUpstreamNodes,
  getDownstreamNodes,
  applySelectionStyles,
  applySelectionEdgeStyles,
  type SelectionState,
} from './graph-selection';

// Node navigation utilities for dependency graph interaction
export {
  getNodeEditRoute,
  getNodeTypeLabel,
  isNodeEditable,
  getNodeEditMessage,
} from './node-navigation';
