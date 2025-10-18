# GraphQL Generated Types

This directory contains TypeScript types and React hooks generated from the backend GraphQL schema.

## Overview

Files in this directory are **automatically generated** by GraphQL Code Generator and should **never be edited manually**. Any manual changes will be overwritten the next time code generation runs.

## Generated Files

- `graphql.ts` - All generated TypeScript types, operation types, and React Apollo hooks
- `introspection.json` - GraphQL schema introspection data (used by IDE tools and GraphQL Playground)

## Running Code Generation

### Prerequisites

Before running code generation, ensure:

1. **Backend API is running**: The code generator needs to introspect the GraphQL schema from the running backend

   ```bash
   pnpm --filter @campaign/api dev
   ```

2. **Backend is accessible**: The API should be available at `http://localhost:4000/graphql`

3. **Database is running**: The backend requires PostgreSQL to be running

### Generate Types and Hooks

```bash
# From project root
pnpm --filter @campaign/frontend codegen

# Or directly in frontend directory
cd packages/frontend
pnpm codegen
```

### Watch Mode (Auto-regenerate on changes)

```bash
# From project root
pnpm --filter @campaign/frontend codegen:watch

# Or directly in frontend directory
cd packages/frontend
pnpm codegen:watch
```

## Configuration

The code generator configuration is in `codegen.ts` at the frontend package root. Key settings:

- **Schema source**: `http://localhost:4000/graphql`
- **Documents**: `src/**/*.{ts,tsx,graphql}` (where you write GraphQL operations)
- **Output**: `src/__generated__/graphql.ts`
- **Plugins**: TypeScript, TypeScript Operations, TypeScript React Apollo

## Usage in Code

### Importing Generated Types

```typescript
import type { Campaign, Settlement, Structure } from '@/__generated__/graphql';

// Use types for component props, state, etc.
interface Props {
  campaign: Campaign;
  settlements: Settlement[];
}
```

### Using Generated Hooks

After writing a GraphQL query in your component:

```typescript
import { gql } from '@apollo/client';
import { useGetCampaignsQuery } from '@/__generated__/graphql';

// Define the query (can be in the same file or a separate .graphql file)
const GET_CAMPAIGNS = gql`
  query GetCampaigns {
    campaigns {
      id
      name
      description
    }
  }
`;

// Use the generated hook
function CampaignList() {
  const { data, loading, error } = useGetCampaignsQuery();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.campaigns.map(campaign => (
        <li key={campaign.id}>{campaign.name}</li>
      ))}
    </ul>
  );
}
```

## Workflow

1. **Write GraphQL operations** in your components using `gql` tags
2. **Run code generation** with `pnpm codegen`
3. **Import and use generated hooks** in your components
4. **Repeat** whenever you add/modify GraphQL operations

## Troubleshooting

### Error: "Failed to load schema from http://localhost:4000/graphql"

**Cause**: Backend API is not running or not accessible

**Solution**: Start the backend API:

```bash
pnpm --filter @campaign/api dev
```

### Error: "Unable to find any GraphQL type definitions"

**Cause**: No GraphQL operations found in source files

**Solution**: This is expected if you haven't written any queries/mutations yet. The schema types will still be generated.

### Error: "connect ECONNREFUSED"

**Cause**: Backend is starting up or not running on the expected port

**Solution**:

1. Check backend is running: `pnpm --filter @campaign/api dev`
2. Verify PORT in backend `.env` is set to 4000
3. Wait a few seconds for backend to fully start, then retry

### Generated files not updating

**Cause**: Code generator cache or file system issue

**Solution**:

1. Delete `__generated__` directory
2. Re-run `pnpm codegen`

## Current Status

**⚠️ Note**: As of Stage 2 completion, the backend API has a dependency injection issue that prevents it from starting:

```
Error: Nest can't resolve dependencies of the SettlementService (..., RulesEngineClientService)
```

**This needs to be fixed before code generation can run successfully.**

Once the backend starts successfully, you can run `pnpm --filter @campaign/frontend codegen` to generate types and hooks.

## Integration with CI/CD

In CI/CD pipelines, code generation should run as part of the build process:

```yaml
# Example GitHub Actions workflow
- name: Generate GraphQL types
  run: pnpm --filter @campaign/frontend codegen

- name: Build frontend
  run: pnpm --filter @campaign/frontend build
```

## References

- [GraphQL Code Generator Documentation](https://the-guild.dev/graphql/codegen/docs/getting-started)
- [TypeScript React Apollo Plugin](https://the-guild.dev/graphql/codegen/plugins/typescript/typescript-react-apollo)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
