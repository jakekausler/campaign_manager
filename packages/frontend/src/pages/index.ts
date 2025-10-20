/**
 * Barrel export for page components
 *
 * Pages are top-level route components that represent entire views.
 * Import from this file to use pages in router configuration.
 */

// Export page components
// Note: Pages are typically lazy-loaded in the router, so direct exports
// from this file may not be used. They're here for consistency and
// potential non-routing use cases.
export { default as HomePage } from './HomePage';
export { default as LoginPage } from './LoginPage';
export { default as DashboardPage } from './DashboardPage';
export { default as MapPage } from './MapPage';
export { default as FlowViewPage } from './FlowViewPage';
export { default as TimelinePage } from './TimelinePage';
export { default as NotFoundPage } from './NotFoundPage';
