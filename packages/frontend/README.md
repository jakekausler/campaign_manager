# Campaign Manager - Frontend

React + TypeScript + Vite frontend application for the Campaign Manager tabletop RPG tool.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3
- **Component Library**: Radix UI + shadcn/ui
- **Routing**: React Router v6
- **Code Quality**: ESLint, Prettier

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

From the project root:

```bash
# Install dependencies
pnpm install

# Start dev server (from root)
pnpm --filter @campaign/frontend dev

# Or use root script
pnpm run dev
```

The dev server will start at http://localhost:3000

### Development Commands

**IMPORTANT**: Always run commands from the project root, never `cd` into this directory.

```bash
# Development server
pnpm --filter @campaign/frontend dev

# Build for production
pnpm --filter @campaign/frontend build

# Preview production build
pnpm --filter @campaign/frontend preview

# Type checking
pnpm --filter @campaign/frontend type-check

# Linting
pnpm --filter @campaign/frontend lint
pnpm --filter @campaign/frontend lint -- --fix

# Formatting
pnpm --filter @campaign/frontend format
pnpm --filter @campaign/frontend format:check
```

## Environment Variables

### Setup

1. Copy `.env.example` to `.env.development`:

   ```bash
   cp packages/frontend/.env.example packages/frontend/.env.development
   ```

2. Update values as needed for your local environment

3. For local overrides, create `.env.local` (gitignored)

### Available Variables

All environment variables must be prefixed with `VITE_` to be exposed to the client.

#### Required Variables

- `VITE_API_URL` - GraphQL API endpoint
  - Development: `/graphql` (proxied to backend)
  - Production: `https://api.example.com/graphql`
- `VITE_API_WS_URL` - WebSocket endpoint for subscriptions
  - Development: `ws://localhost:3000/graphql` (proxied to backend)
  - Production: `wss://api.example.com/graphql`
- `VITE_APP_NAME` - Application name displayed in UI
- `VITE_ENVIRONMENT` - Current environment (development, staging, production)

#### Optional Variables

- `VITE_ENABLE_DEBUG` - Enable debug logging (true/false)
- `VITE_ENABLE_MOCK_AUTH` - Enable mock authentication (true/false, dev only)
- `VITE_ANALYTICS_ID` - Analytics tracking ID
- `VITE_SENTRY_DSN` - Sentry error tracking DSN

### Usage in Code

```typescript
import { env } from '@/config';

// Type-safe access
const apiUrl = env.api.url;

// Feature flags
if (env.features.debug) {
  console.log('Debug enabled');
}
```

See `src/config/README.md` for detailed documentation.

## API Integration

### Development Proxy

In development, Vite automatically proxies API requests to the backend:

- **GraphQL HTTP**: `http://localhost:3000/graphql` → `http://localhost:4000/graphql`
- **GraphQL WebSocket**: `ws://localhost:3000/graphql` → `ws://localhost:4000/graphql`
- **REST API** (if any): `http://localhost:3000/api` → `http://localhost:4000/api`

**Benefits:**

- No CORS issues in development
- Single port for frontend and API
- Matches production URL structure

**Configuration** in `vite.config.ts`:

```typescript
server: {
  proxy: {
    '/graphql': {
      target: 'http://localhost:4000',
      ws: true, // Enable WebSocket proxying
    },
  },
}
```

### GraphQL Client

Apollo Client is configured in `src/services/api/graphql-client.ts`:

```typescript
import { graphqlClient } from '@/services';

// Query example
const { data } = await graphqlClient.query({
  query: GET_CAMPAIGN,
  variables: { id: '123' },
});

// Mutation example
const { data } = await graphqlClient.mutate({
  mutation: CREATE_CAMPAIGN,
  variables: { input: { name: 'My Campaign' } },
});
```

Features:

- Automatic authentication headers (Bearer token)
- Error handling and logging
- WebSocket support for subscriptions
- Optimistic UI updates
- Cache normalization

See `src/services/README.md` for API client documentation.

### GraphQL Code Generation

TypeScript types and React hooks are automatically generated from the backend GraphQL schema using GraphQL Code Generator.

**Setup commands:**

```bash
# Generate types and hooks (requires backend running on port 4000)
pnpm --filter @campaign/frontend codegen

# Watch mode - auto-regenerate on schema changes
pnpm --filter @campaign/frontend codegen:watch
```

**Prerequisites:**

1. Backend API must be running: `pnpm --filter @campaign/api dev`
2. Backend must be accessible at `http://localhost:4000/graphql`
3. PostgreSQL database must be running

**Generated files** (in `src/__generated__/`):

- `graphql.ts` - All TypeScript types and React Apollo hooks
- `introspection.json` - Schema introspection data for IDE tools

**Usage example:**

```typescript
import { gql } from '@apollo/client';
import { useGetCampaignsQuery } from '@/__generated__/graphql';

// Define the query - GraphQL Code Generator uses the query name to generate hooks
const GET_CAMPAIGNS = gql`
  query GetCampaigns {
    campaigns {
      id
      name
    }
  }
`;

function CampaignList() {
  // The hook is automatically generated and linked to the query by name
  const { data, loading, error } = useGetCampaignsQuery();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data?.campaigns.map(c => <li key={c.id}>{c.name}</li>)}
    </ul>
  );
}
```

**Configuration** in `codegen.ts` at package root.

See `src/__generated__/README.md` for detailed documentation.

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/          # Reusable UI primitives (shadcn/ui)
│   ├── features/    # Feature-specific components
│   └── layout/      # Layout components (headers, footers)
├── pages/           # Route components
├── router/          # React Router configuration
├── hooks/           # Custom React hooks
├── utils/           # Pure utility functions
├── services/        # API clients and external integrations
├── types/           # TypeScript type definitions
├── lib/             # Third-party library configurations
├── config/          # Application configuration
└── main.tsx         # Application entry point
```

See individual `README.md` files in each directory for detailed documentation.

## Routing

The application uses React Router v6 with code-splitting:

- `/` - Home page
- `/auth/login` - Login page
- `/dashboard` - Main dashboard (protected)

See `src/router/README.md` for routing documentation.

## Styling

### Tailwind CSS

Utility-first CSS framework with custom theme configuration in `tailwind.config.js`.

```tsx
<div className="flex items-center gap-4 p-4 bg-primary text-primary-foreground">Content</div>
```

### Component Library

shadcn/ui components (built on Radix UI primitives):

```tsx
import { Button, Card, Dialog } from '@/components/ui';

<Button variant="default" size="lg">
  Click Me
</Button>;
```

Available components: Button, Card, Dialog, etc.

## Code Quality

### TypeScript

Strict mode enabled. All code must type-check:

```bash
pnpm --filter @campaign/frontend type-check
```

### ESLint

React + TypeScript + Accessibility rules:

```bash
pnpm --filter @campaign/frontend lint
```

### Prettier

Consistent code formatting:

```bash
pnpm --filter @campaign/frontend format
```

### Pre-commit Hooks

Quality checks run automatically via Husky hooks:

- Lint staged files
- Format staged files
- Type check on pre-push

## Building for Production

```bash
# Build
pnpm --filter @campaign/frontend build

# Preview build locally
pnpm --filter @campaign/frontend preview
```

Build output is in `dist/`:

- HTML entry point
- JavaScript bundles (code-split)
- CSS files
- Assets

## Development Guidelines

1. **Never change directories** - Run all commands from project root
2. **Use path aliases** - Import with `@/` instead of relative paths
3. **Type everything** - No implicit `any` types
4. **Accessibility first** - Use semantic HTML and ARIA attributes
5. **Component composition** - Build complex UIs from simple components
6. **Code splitting** - Use lazy loading for routes

See `/storage/programs/campaign_manager/CLAUDE.md` for complete development guidelines.

## Troubleshooting

### Dev server won't start

1. Check port 3000 is available
2. Verify environment variables are set
3. Try cleaning and reinstalling: `pnpm run clean && pnpm install`

### TypeScript errors

Use the TypeScript Fixer subagent - never fix manually.

### Build failures

1. Run type-check to identify issues
2. Ensure all dependencies are installed
3. Check for missing environment variables

### Hot reload not working

1. Check file watch limits (Linux): `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf`
2. Restart dev server
3. Clear browser cache

## Contributing

Follow the TDD workflow:

1. Write failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Use TypeScript Fixer for type errors
5. Use Code Reviewer before committing

## License

[To be determined]
