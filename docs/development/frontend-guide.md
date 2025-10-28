# Frontend Development Guide

> **Quick navigation:** [← Back to CLAUDE.md](../../CLAUDE.md)

This guide covers the React frontend (`packages/frontend/`) - a modern single-page application built with Vite, TypeScript, and Tailwind CSS.

---

## Frontend Development

The React frontend (`packages/frontend/`) is a modern single-page application built with Vite, TypeScript, and Tailwind CSS.

### Tech Stack

- **React 18** - UI library with concurrent features
- **TypeScript** - Strict mode enabled for type safety
- **Vite 5** - Build tool with fast HMR and optimized production builds
- **Tailwind CSS 3** - Utility-first CSS with JIT compilation
- **Radix UI** - Accessible component primitives (Dialog, Slot, Label)
- **shadcn/ui** - Pre-built components built on Radix UI
- **React Router 7** - Client-side routing with lazy loading
- **Zustand** - State management with slice pattern and persistence
- **Apollo Client 4** - GraphQL client with caching and subscriptions
- **GraphQL Code Generator** - TypeScript types and hooks from schema
- **Vitest + MSW** - Testing infrastructure with API mocking

### Project Structure

```
packages/frontend/
├── src/
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui primitives (Button, Card, Dialog)
│   │   ├── features/    # Business logic components
│   │   └── layout/      # Layout components (MainLayout, AuthLayout)
│   ├── pages/           # Route components (HomePage, DashboardPage, etc.)
│   ├── router/          # React Router configuration and ProtectedRoute
│   ├── stores/          # Zustand state management (auth, campaign)
│   ├── services/        # API clients (GraphQL, REST)
│   │   └── api/
│   │       ├── hooks/         # Custom GraphQL query hooks
│   │       ├── mutations/     # Custom GraphQL mutation hooks
│   │       └── graphql-client.ts  # Apollo Client configuration
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Pure utility functions
│   ├── types/           # TypeScript type definitions
│   ├── lib/             # Third-party library configurations
│   ├── config/          # Environment configuration with validation
│   ├── __generated__/   # GraphQL Code Generator output
│   └── __tests__/       # Test setup, MSW handlers, utilities
├── .env.example         # Environment variable template
├── vite.config.ts       # Vite configuration with proxy and Vitest
├── tailwind.config.js   # Tailwind CSS configuration
├── codegen.ts           # GraphQL Code Generator configuration
└── tsconfig.json        # TypeScript configuration
```

### Development Workflow

**Running the Dev Server:**

```bash
# From project root (NEVER cd into packages/frontend)
pnpm --filter @campaign/frontend dev
```

The dev server runs on http://localhost:9263 (configurable via VITE_PORT) with:

- Hot module replacement (HMR) for instant updates
- Vite proxy forwarding `/graphql` to backend on port 9264 (configurable via VITE_BACKEND_PORT)
- Mock authentication for development

**Environment Variables:**

Frontend uses Vite's environment system (variables must start with `VITE_`):

```bash
# Copy template
cp packages/frontend/.env.example packages/frontend/.env

# Edit environment variables
# Port configuration (defaults: frontend=9263, backend=9264)
VITE_PORT=9263
VITE_BACKEND_PORT=9264

# Development uses relative URLs (proxied by Vite)
VITE_API_URL=/graphql
VITE_API_WS_URL=ws://localhost:9263/graphql

# Production uses absolute HTTPS URLs
VITE_API_URL=https://api.yourdomain.com/graphql
VITE_API_WS_URL=wss://api.yourdomain.com/graphql
```

**Important**: Environment variables are validated at startup. Missing required variables will fail fast with helpful error messages.

### Key Features

**Routing:**

- React Router 7 with `createBrowserRouter` for type-safe routing
- Lazy loading for all pages with `React.lazy()` and `Suspense`
- Protected routes with `ProtectedRoute` wrapper
- Nested layouts (`MainLayout` for public pages, `AuthLayout` for auth pages)

**State Management:**

- Zustand with slice pattern (auth, campaign)
- Token and campaign ID persisted to localStorage
- Redux DevTools integration in development
- Fine-grained reactivity with optimized selector hooks
- Automatic integration with Apollo Client (token injection)

**Authentication:**

- Mock authentication for development using Zustand store
- `ProtectedRoute` component redirects to login when unauthenticated
- Preserves intended destination for post-login redirect
- JWT token managed by Zustand (persisted to localStorage)

**GraphQL Integration:**

- Apollo Client 4 with comprehensive error handling
- HTTP link for queries/mutations, WebSocket link for subscriptions
- Automatic Bearer token injection from Zustand store
- Smart retry logic (stops on auth failures, retries on transient errors)
- Custom cache policies (cache-first for details, cache-and-network for lists)
- Computed fields disabled from caching (merge: false)
- Specialized hooks for Settlement and Structure entities
- Mutation hooks with cache update strategies (refetchQueries, eviction, field modifications)

**Code Generation:**

- GraphQL Code Generator produces TypeScript types from schema
- Requires backend running on port 9264 (or set GRAPHQL_SCHEMA_URL)
- Generated files in `src/__generated__/graphql.ts`
- Custom scalar mappings (DateTime→string, JSON→Record, UUID→string)

**Development Proxy:**

- Vite proxy eliminates CORS issues in development
- `/graphql` proxied to `http://localhost:9264` (configurable via VITE_BACKEND_PORT)
- WebSocket proxying enabled for GraphQL subscriptions
- Production uses absolute URLs (no proxy)

**Code Splitting:**

- Route-based code splitting via lazy loading
- Vendor chunk separation (React, React Router, Radix UI)
- Each page is a separate chunk (<3KB per page)
- Main bundle: ~150KB gzipped

**Styling:**

- Tailwind CSS with JIT compilation
- HSL color system for easy theme customization
- Dark mode support (class strategy, not yet implemented)
- Custom animations via `tailwindcss-animate`

**Accessibility:**

- Radix UI primitives follow WAI-ARIA patterns
- ESLint plugin `jsx-a11y` for automated checks
- Proper ARIA attributes on all interactive elements
- Keyboard navigation support

**Testing:**

- Vitest with Vite-native test runner (fast, no transpilation)
- @testing-library/react for React component testing
- MSW v2 for GraphQL API mocking at network level
- happy-dom environment (faster than jsdom)
- 128 tests covering stores, hooks, and mutations
- Unit tests for Zustand stores (auth, campaign)
- Integration tests for GraphQL hooks (queries, mutations)
- MSW handlers for realistic GraphQL responses
- Test utilities: `createTestApolloClient`, `renderWithApollo`

### Common Tasks

**Adding a New Page:**

1. Create page component in `src/pages/`:

```typescript
// src/pages/NewPage.tsx
export default function NewPage() {
  return <div>New Page</div>;
}
```

2. Add route to `src/router/index.tsx`:

```typescript
const NewPage = lazy(() => import('@/pages/NewPage'));

// In router config:
{
  path: 'new',
  element: (
    <LazyPage>
      <NewPage />
    </LazyPage>
  ),
}
```

3. Export from `src/pages/index.ts`

**Adding a New Component:**

1. Create in appropriate directory:
   - `src/components/ui/` - Reusable primitives
   - `src/components/features/` - Business logic components
   - `src/components/layout/` - Layout components

2. Export from `index.ts` in that directory

**Adding GraphQL Operations:**

1. Use specialized hooks for Settlement and Structure operations:

```typescript
import {
  useSettlementsByKingdom,
  useSettlementDetails,
  useCreateSettlement,
  useUpdateSettlement,
} from '@/services/api/hooks';

// Query settlements
const { settlements, loading, error, refetch } = useSettlementsByKingdom(kingdomId);

// Create settlement
const { createSettlement, loading: creating } = useCreateSettlement();
await createSettlement({ kingdomId, locationId, name, level });

// Update settlement
const { updateSettlement } = useUpdateSettlement();
await updateSettlement(id, { name: 'New Name' });
```

2. For custom queries, define in component and use Apollo Client hooks:

```typescript
import { gql, useQuery } from '@apollo/client';

const GET_CAMPAIGNS = gql`
  query GetCampaigns {
    campaigns {
      id
      name
    }
  }
`;

const { data, loading, error } = useQuery(GET_CAMPAIGNS);
```

3. Run code generation to get TypeScript types (requires backend running):

```bash
pnpm --filter @campaign/frontend codegen
```

**Adding Environment Variables:**

1. Add to `packages/frontend/.env.example` with documentation
2. Add TypeScript types to `src/types/env.d.ts`
3. Add validation to `src/config/env.ts`
4. Access via `env` object (never use `import.meta.env` directly)

### Testing

**IMPORTANT**: Use the TypeScript Tester subagent to run and debug tests.

```bash
# Commands below are for reference only - use TypeScript Tester subagent

# Run all frontend tests
pnpm --filter @campaign/frontend test

# Run tests in watch mode
pnpm --filter @campaign/frontend test:watch

# Run tests with coverage
pnpm --filter @campaign/frontend test -- --coverage
```

Frontend uses Vitest (Vite-native test runner) instead of Jest.

### Troubleshooting

**Dev server won't start:**

- Check that port 9263 is available (or set VITE_PORT to a different port)
- Verify `.env` file exists with required variables
- Run `pnpm install` from project root

**GraphQL requests fail:**

- Verify backend API is running on port 9264 (or configured VITE_BACKEND_PORT)
- Check proxy configuration in `vite.config.ts`
- Verify `VITE_API_URL` environment variable

**Type errors:**

- Run `pnpm --filter @campaign/frontend type-check`
- Use TypeScript Fixer subagent to resolve errors

**Build fails:**

- Run `pnpm --filter @campaign/frontend build`
- Check for missing environment variables
- Verify all imports are correct

### Best Practices

1. **Never use `cd`** - Always run commands from project root with `pnpm --filter`
2. **Use path aliases** - Import with `@/components` instead of relative paths
3. **Lazy load pages** - Always use `React.lazy()` for route components
4. **Validate props** - Use TypeScript interfaces for all component props
5. **Accessible components** - Follow ARIA patterns, use semantic HTML
6. **Environment config** - Never use `import.meta.env` directly, use `env` object
7. **GraphQL errors** - Always handle `loading` and `error` states
8. **Mock auth warnings** - Prominent comments warn about insecurity

### Documentation

- **Frontend README**: `packages/frontend/README.md` - Comprehensive setup guide
- **Component docs**: README files in each `src/` subdirectory
- **Router docs**: `src/router/README.md` - Routing patterns
- **Config docs**: `src/config/README.md` - Environment variables

### Implementation

Frontend infrastructure completed across two tickets:

**TICKET-017: Frontend Setup** (8 stages):

1. Initialize Vite + React + TypeScript
2. Configure Tailwind CSS + Radix UI
3. Configure ESLint and Prettier
4. Create Folder Structure
5. Set Up Routing with React Router
6. Configure Environment Variables
7. Add Development Proxy and GraphQL Client
8. Testing and Documentation

**TICKET-018: State Management & GraphQL Client** (16 stages):

1. Install Dependencies and Configure Zustand
2. Configure GraphQL Code Generator
3. Set Up GraphQL Client (Apollo Client)
4. Create Auth State Management
5. Create Campaign Context State
6. Create Settlement GraphQL Hooks
7. Create Structure GraphQL Hooks
8. Implement Mutation Helpers and Optimistic Updates
9. Test Infrastructure and Store Unit Tests
10. Settlement Hooks Integration Tests
11. Structure Hooks Integration Tests
12. Settlement Mutation Integration Tests
13. Structure Mutation Integration Tests
14. Code Documentation
15. Final Quality Checks
16. Project Documentation Updates

See `plan/TICKET-017.md` and `plan/TICKET-018.md` for detailed implementation notes and commit hashes.

---

**Related Documentation:**

- [CLAUDE.md](../../CLAUDE.md) - Main development guide
- [packages/frontend/README.md](../../packages/frontend/README.md) - Frontend setup
- [packages/frontend/src/router/README.md](../../packages/frontend/src/router/README.md) - Routing patterns
- [packages/frontend/src/config/README.md](../../packages/frontend/src/config/README.md) - Environment config
