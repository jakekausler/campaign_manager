# Configuration

This directory contains application configuration modules.

## Purpose

Centralized configuration management for environment variables, feature flags, and application settings. All configuration is validated at startup to fail fast if required values are missing.

## Structure

```
config/
├── env.ts           # Environment variable configuration with validation
├── index.ts         # Barrel exports
└── README.md        # This file
```

## Usage

### Environment Variables

```typescript
import { env } from '@/config';

// API configuration
const apiClient = new GraphQLClient(env.api.url);

// Feature flags
if (env.features.debug) {
  console.log('Debug mode enabled');
}

// Environment checks
if (env.isProd) {
  // Initialize production monitoring
}
```

### Adding New Environment Variables

1. Add the variable to `.env.example`, `.env.development`, and `.env.production`
2. Add the TypeScript type to `src/types/env.d.ts` in the `ImportMetaEnv` interface
3. Add the parsed value to the `env` object in `src/config/env.ts`
4. Use validation for required variables with `requireEnv()`
5. Use `parseBoolean()` helper for boolean flags

**Example:**

```typescript
// In src/types/env.d.ts
interface ImportMetaEnv {
  readonly VITE_MY_FEATURE: string;
}

// In src/config/env.ts
export const env = Object.freeze({
  features: {
    myFeature: parseBoolean(import.meta.env.VITE_MY_FEATURE),
  },
});
```

## Guidelines

1. **Validation**: Always validate required environment variables at startup
2. **Type Safety**: Use TypeScript types for all configuration values
3. **Immutability**: The `env` object is frozen to prevent runtime modifications
4. **Naming**: Use `VITE_` prefix for all custom environment variables (required by Vite)
5. **Secrets**: NEVER commit sensitive values to `.env.development` or `.env.production`
6. **Defaults**: Provide safe defaults in `.env.development` for local development
7. **Documentation**: Document all variables in `.env.example` with comments

## Security

- Environment variables are embedded in the client bundle at build time
- NEVER store secrets or API keys in environment variables
- Use backend environment variables for sensitive configuration
- Client-side env vars are PUBLIC - treat them as such

## Environment Files

- `.env.example`: Template with all available variables (committed to repository)
- `.env.development`: Development configuration (NOT committed, create locally from .env.example)
- `.env.production`: Production configuration (NOT committed, set via CI/CD)
- `.env.staging`: Staging configuration (NOT committed, set via CI/CD)
- `.env.local`: Local overrides (NOT committed, gitignored)

**IMPORTANT**: Only `.env.example` should be committed to version control. All other `.env*` files are gitignored to prevent accidental exposure of configuration values.

## Built-in Vite Variables

Vite provides several built-in environment variables:

- `import.meta.env.MODE`: Current mode ('development' or 'production')
- `import.meta.env.DEV`: Boolean, true in development
- `import.meta.env.PROD`: Boolean, true in production
- `import.meta.env.BASE_URL`: Base URL for the app

These are accessible via the `env` object: `env.mode`, `env.isDev`, `env.isProd`, `env.baseUrl`.
