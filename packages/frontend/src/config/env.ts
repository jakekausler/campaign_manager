/**
 * Environment Configuration Module
 *
 * This module provides type-safe access to environment variables with validation.
 * All environment variables are loaded from import.meta.env (Vite's env system).
 *
 * Required variables will throw an error if missing at startup.
 * Optional variables return undefined if not set.
 */

/**
 * Validates that a required environment variable is present.
 * Throws an error if the variable is missing or empty.
 */
function requireEnv(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Please ensure ${key} is set in your .env file.\n` +
        `See .env.example for required variables.`
    );
  }
  return value;
}

/**
 * Converts string environment variable to boolean.
 * Accepts: 'true', '1', 'yes' (case-insensitive) as true.
 * Everything else is false.
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Validates WebSocket URL protocol based on environment.
 * In production, enforces secure WebSocket (wss://) protocol.
 * Throws error if insecure ws:// is used in production.
 */
function validateWebSocketUrl(url: string, environment: string): string {
  const isProd = environment === 'production';
  const isSecure = url.startsWith('wss://');
  const isInsecure = url.startsWith('ws://');

  if (isProd && isInsecure) {
    throw new Error(
      `Insecure WebSocket URL detected in production environment.\n` +
        `URL: ${url}\n` +
        `Production environments must use secure WebSocket protocol (wss://).\n` +
        `Please update VITE_API_WS_URL to use wss:// instead of ws://`
    );
  }

  if (!isSecure && !isInsecure) {
    throw new Error(
      `Invalid WebSocket URL protocol: ${url}\n` + `WebSocket URLs must start with ws:// or wss://`
    );
  }

  return url;
}

/**
 * Validates API URL based on environment.
 * In development, allows relative URLs (proxied by Vite).
 * In production, enforces HTTPS protocol.
 */
function validateApiUrl(url: string, environment: string): string {
  const isProd = environment === 'production';
  const isRelative = url.startsWith('/');
  const isSecure = url.startsWith('https://');
  const isInsecure = url.startsWith('http://');

  // In production, require HTTPS
  if (isProd && !isSecure) {
    throw new Error(
      `Insecure or invalid API URL detected in production environment.\n` +
        `URL: ${url}\n` +
        `Production environments must use HTTPS protocol (https://).\n` +
        `Please update VITE_API_URL to use https://`
    );
  }

  // In development, allow relative URLs (proxied) or http/https
  if (!isProd && !isRelative && !isSecure && !isInsecure) {
    throw new Error(
      `Invalid API URL: ${url}\n` +
        `API URLs must be:\n` +
        `  - Relative path (e.g., /graphql) for proxied development\n` +
        `  - Full HTTP/HTTPS URL (e.g., http://localhost:9264/graphql or https://api.example.com/graphql)`
    );
  }

  return url;
}

// Validate environment first (needed for WebSocket validation)
const environment = requireEnv('VITE_ENVIRONMENT', import.meta.env.VITE_ENVIRONMENT);

/**
 * Environment configuration object with validated values.
 * This object is frozen to prevent modifications at runtime.
 */
export const env = Object.freeze({
  // API Configuration
  api: {
    url: validateApiUrl(requireEnv('VITE_API_URL', import.meta.env.VITE_API_URL), environment),
    wsUrl: validateWebSocketUrl(
      requireEnv('VITE_API_WS_URL', import.meta.env.VITE_API_WS_URL),
      environment
    ),
  },

  // Application Configuration
  app: {
    name: requireEnv('VITE_APP_NAME', import.meta.env.VITE_APP_NAME),
    environment: environment as 'development' | 'staging' | 'production',
  },

  // Feature Flags
  features: {
    debug: parseBoolean(import.meta.env.VITE_ENABLE_DEBUG),
    mockAuth: parseBoolean(import.meta.env.VITE_ENABLE_MOCK_AUTH),
  },

  // Optional Configuration
  analytics: {
    id: import.meta.env.VITE_ANALYTICS_ID,
  },

  monitoring: {
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
  },

  // Built-in Vite variables
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  baseUrl: import.meta.env.BASE_URL,
});

/**
 * Type-safe environment configuration.
 * Use this throughout the application instead of import.meta.env.
 *
 * @example
 * ```typescript
 * import { env } from '@/config/env';
 *
 * // API configuration
 * const apiUrl = env.api.url;
 *
 * // Feature flags
 * if (env.features.debug) {
 *   console.log('Debug mode enabled');
 * }
 *
 * // Environment checks
 * if (env.isProd) {
 *   // Production-only code
 * }
 * ```
 */
export type Env = typeof env;

/**
 * Logs environment configuration on startup (development only).
 * Useful for debugging environment variable issues.
 * Triple-check to prevent any logging in production builds.
 */
if (env.features.debug && env.isDev && !env.isProd) {
  console.group('🔧 Environment Configuration');
  console.log('Environment:', env.app.environment);
  console.log('API URL:', env.api.url);
  console.log('WebSocket URL:', env.api.wsUrl);
  console.log('Debug Mode:', env.features.debug);
  console.log('Mock Auth:', env.features.mockAuth);
  console.groupEnd();
}
