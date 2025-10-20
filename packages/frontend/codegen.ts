import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * GraphQL Code Generator Configuration
 *
 * This configuration generates TypeScript types and React Apollo hooks
 * from the backend GraphQL schema and frontend GraphQL operations.
 *
 * Generated files are written to src/__generated__/ and should not be
 * edited manually. They are regenerated when you run `pnpm codegen`.
 *
 * IMPORTANT: The backend API must be running on http://localhost:9264
 * before running code generation. Start it with: pnpm --filter @campaign/api dev
 *
 * @see https://the-guild.dev/graphql/codegen/docs/getting-started
 */
const config: CodegenConfig = {
  // Override warnings for better output
  overwrite: true,

  // Schema source: Backend GraphQL API endpoint
  // In development: Use localhost:9264 directly (bypasses Vite proxy for introspection)
  // IMPORTANT: Backend API must be running before code generation
  // Can be overridden via GRAPHQL_SCHEMA_URL environment variable
  schema: process.env.GRAPHQL_SCHEMA_URL || 'http://localhost:9264/graphql',

  // Documents: Where to find GraphQL operations (queries, mutations, subscriptions)
  // These are the .graphql files or inline gql`` tags you write
  documents: ['src/**/*.{ts,tsx,graphql}'],

  // Ignore generated files when searching for operations
  ignoreNoDocuments: true,

  // Generate multiple outputs
  generates: {
    // Generate all TypeScript types and hooks in a single file
    // This is simpler than near-operation-file preset and works well for most projects
    'src/__generated__/graphql.ts': {
      plugins: [
        'typescript', // Generate TypeScript types from schema
        'typescript-operations', // Generate types for operations (queries, mutations, subscriptions)
        'typescript-react-apollo', // Generate React Apollo hooks (useQuery, useMutation, etc.)
      ],
      config: {
        // Customizations for generated types
        skipTypename: false, // Include __typename in types (useful for cache normalization)
        enumsAsTypes: true, // Generate enums as union types (safer than TS enums)
        scalars: {
          // Custom scalar type mappings
          DateTime: 'string', // Map DateTime scalar to string
          JSON: 'Record<string, unknown>', // Map JSON scalar to object
          UUID: 'string', // Map UUID scalar to string
        },
        // Add useful utility types
        maybeValue: 'T | null | undefined', // Make nullable types more explicit
        // Avoid importing types from external packages
        avoidOptionals: {
          field: false, // Keep optional fields as optional (field?: Type)
          inputValue: false, // Keep optional input fields as optional
          object: false, // Keep optional object fields as optional
        },
        // Hook generation settings
        withHooks: true, // Generate React hooks
        withComponent: false, // Don't generate HOC components (hooks are preferred)
        withHOC: false, // Don't generate HOC (hooks are preferred)
        // Hook naming conventions
        addDocBlocks: true, // Add JSDoc comments to generated hooks
        dedupeFragments: true, // Deduplicate fragments to reduce bundle size
        // Use generic types for better type inference
        preResolveTypes: true, // Resolve types before generating (better type inference)
      },
    },

    // Generate GraphQL introspection JSON (useful for tooling and IDE support)
    'src/__generated__/introspection.json': {
      plugins: ['introspection'],
      config: {
        minify: true, // Minify introspection JSON to reduce size
      },
    },
  },

  // Hooks to run before/after generation
  hooks: {
    afterAllFileWrite: [
      // Format generated files with Prettier
      // Continues even if Prettier fails (defensive programming)
      'prettier --write || echo "Warning: Prettier formatting failed"',
    ],
  },
};

export default config;
