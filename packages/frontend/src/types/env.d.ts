/// <reference types="vite/client" />

/**
 * Type definitions for environment variables in Vite.
 *
 * Vite exposes env variables on the special import.meta.env object.
 * All variables must be prefixed with VITE_ to be exposed to the client.
 *
 * @see https://vitejs.dev/guide/env-and-mode.html
 */

interface ImportMetaEnv {
  // API Configuration
  /** GraphQL API endpoint URL */
  readonly VITE_API_URL: string;

  /** GraphQL WebSocket endpoint URL for subscriptions */
  readonly VITE_API_WS_URL: string;

  // Application Configuration
  /** Application name displayed in the UI */
  readonly VITE_APP_NAME: string;

  /** Current environment (development, staging, production) */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  // Feature Flags
  /** Enable debug logging in browser console */
  readonly VITE_ENABLE_DEBUG: string;

  /** Enable mock authentication (for development only) */
  readonly VITE_ENABLE_MOCK_AUTH: string;

  // Optional Configuration
  /** Analytics tracking ID (optional) */
  readonly VITE_ANALYTICS_ID?: string;

  /** Sentry DSN for error tracking (optional) */
  readonly VITE_SENTRY_DSN?: string;

  // Built-in Vite variables
  /** Current mode (development, production) */
  readonly MODE: string;

  /** Is running in development mode */
  readonly DEV: boolean;

  /** Is running in production mode */
  readonly PROD: boolean;

  /** Is running in SSR mode */
  readonly SSR: boolean;

  /** Base URL for the app */
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
