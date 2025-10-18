/**
 * Barrel export for service modules
 *
 * Services handle communication with external systems (API, WebSocket, etc.).
 * Import from this file to use services throughout the app.
 */

// Export services here as they are created
export { graphqlClient } from './api/graphql-client';

// Example future exports:
// export { campaignService } from './api/campaigns';
// export { kingdomService } from './api/kingdoms';
// export { authService } from './api/auth';
// export { realtimeService } from './websocket/realtime';
