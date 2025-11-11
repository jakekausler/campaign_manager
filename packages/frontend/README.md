# Campaign Manager - Frontend

React + TypeScript + Vite frontend application for the Campaign Manager tabletop RPG tool.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v3
- **Component Library**: Radix UI + shadcn/ui
- **Routing**: React Router v7
- **State Management**: Zustand (with persist middleware)
- **GraphQL Client**: Apollo Client v4
- **Code Generation**: GraphQL Code Generator
- **Testing**: Vitest + Testing Library + MSW
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

The dev server will start at http://localhost:9263 (configurable via VITE_PORT)

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

# Testing
pnpm --filter @campaign/frontend test
pnpm --filter @campaign/frontend test:watch

# Code generation (requires backend running)
pnpm --filter @campaign/frontend codegen
pnpm --filter @campaign/frontend codegen:watch
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

- `VITE_PORT` - Frontend dev server port (default: 9263)
- `VITE_BACKEND_PORT` - Backend API port for proxy (default: 9264)
- `VITE_API_URL` - GraphQL API endpoint
  - Development: `/graphql` (proxied to backend)
  - Production: `https://api.example.com/graphql`
- `VITE_API_WS_URL` - WebSocket endpoint for subscriptions
  - Development: `ws://localhost:9263/graphql` (proxied to backend)
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

## State Management

The application uses Zustand for global state management with a slice-based architecture.

### Store Architecture

```typescript
import { useAuthStore, useCampaignStore } from '@/stores';

// Auth slice - authentication state
const { token, user, isAuthenticated, login, logout } = useAuthStore();

// Campaign slice - campaign context state
const { currentCampaignId, currentBranchId, asOfTime, setCurrentCampaign } = useCampaignStore();
```

### Features

- **Slice Pattern**: Separate concerns (auth, campaign) with combined root store
- **Persistence**: Token and campaign ID persisted to localStorage
- **DevTools**: Redux DevTools integration in development
- **Fine-Grained Reactivity**: Optimized selector hooks prevent unnecessary re-renders
- **Apollo Integration**: Store provides auth token to GraphQL client automatically

See `src/stores/README.md` for comprehensive documentation.

## API Integration

### Development Proxy

In development, Vite automatically proxies API requests to the backend:

- **GraphQL HTTP**: `http://localhost:9263/graphql` → `http://localhost:9264/graphql`
- **GraphQL WebSocket**: `ws://localhost:9263/graphql` → `ws://localhost:9264/graphql`
- **REST API** (if any): `http://localhost:9263/api` → `http://localhost:9264/api`

Ports are configurable via `VITE_PORT` and `VITE_BACKEND_PORT` environment variables.

**Benefits:**

- No CORS issues in development
- Single port for frontend and API
- Matches production URL structure

**Configuration** in `vite.config.ts`:

```typescript
// Reads VITE_BACKEND_PORT from .env (default: 9264)
const BACKEND_PORT = parseInt(process.env.VITE_BACKEND_PORT || '9264', 10);

server: {
  proxy: {
    '/graphql': {
      target: `http://localhost:${BACKEND_PORT}`,
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

- Automatic authentication headers (Bearer token from Zustand store)
- Error handling and retry logic with circuit breaker
- WebSocket support for GraphQL subscriptions
- Cache normalization (keyFields: ['id'] for all entities)
- Custom cache policies (cache-first for details, cache-and-network for lists)
- Computed fields disabled from caching (merge: false for fresh data)

### Custom GraphQL Hooks

The application provides specialized hooks for domain entities:

**Settlement Hooks:**

```typescript
import {
  useSettlementsByKingdom,
  useSettlementDetails,
  useStructuresBySettlement,
} from '@/services/api/hooks';

// List settlements by kingdom
const { settlements, loading, error, refetch } = useSettlementsByKingdom(kingdomId);

// Get settlement details
const { settlement, loading, error } = useSettlementDetails(settlementId);

// Get structures in a settlement
const { structures, loading, error } = useStructuresBySettlement(settlementId);
```

**Structure Hooks:**

```typescript
import { useStructureDetails, useStructureConditions } from '@/services/api/hooks';

// Get structure details
const { structure, loading, error, refetch } = useStructureDetails(structureId);

// Get computed fields for a structure
const { computedFields, loading, error } = useStructureConditions(structureId);
```

**Mutation Hooks:**

```typescript
import {
  useCreateSettlement,
  useUpdateSettlement,
  useDeleteSettlement,
  useCreateStructure,
  useUpdateStructure,
  useDeleteStructure,
} from '@/services/api/hooks';

// Create settlement
const { createSettlement, loading } = useCreateSettlement();
await createSettlement({ kingdomId, locationId, name, level });

// Update structure
const { updateStructure, loading } = useUpdateStructure();
await updateStructure(id, { name: 'New Name' });

// Delete (soft delete)
const { deleteSettlement, loading } = useDeleteSettlement();
await deleteSettlement(id);
```

All mutation hooks support:

- Cache updates (refetchQueries for creates, cache modification for updates)
- Archive/restore operations (soft delete management)
- Loading and error states
- Optional branchId parameter for temporal queries

See `src/services/api/README.md` for comprehensive API client documentation.

### GraphQL Code Generation

TypeScript types and React hooks are automatically generated from the backend GraphQL schema using GraphQL Code Generator.

**Setup commands:**

```bash
# Generate types and hooks (requires backend running on port 9264)
pnpm --filter @campaign/frontend codegen

# Watch mode - auto-regenerate on schema changes
pnpm --filter @campaign/frontend codegen:watch
```

**Prerequisites:**

1. Backend API must be running: `pnpm --filter @campaign/api dev`
2. Backend must be accessible at `http://localhost:9264/graphql` (or set GRAPHQL_SCHEMA_URL)
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
├── pages/           # Route components (lazy-loaded)
├── router/          # React Router configuration
├── stores/          # Zustand state management
│   ├── auth-slice.ts      # Authentication state
│   ├── campaign-slice.ts  # Campaign context state
│   └── index.ts           # Root store with middleware
├── services/        # API clients and external integrations
│   └── api/
│       ├── hooks/         # Custom GraphQL query hooks
│       ├── mutations/     # Custom GraphQL mutation hooks
│       └── graphql-client.ts  # Apollo Client configuration
├── hooks/           # Custom React hooks
├── utils/           # Pure utility functions
├── types/           # TypeScript type definitions
├── lib/             # Third-party library configurations
├── config/          # Application configuration
├── __generated__/   # GraphQL Code Generator output
└── __tests__/       # Test setup and utilities
    ├── setup.ts           # Global test setup
    ├── mocks/             # MSW handlers and mock data
    └── utils/             # Test utilities (Apollo Client wrapper)
```

See individual `README.md` files in each directory for detailed documentation.

## Routing

The application uses React Router v7 with code-splitting:

- `/` - Home page
- `/auth/login` - Login page
- `/dashboard` - Main dashboard (protected)
- `/map` - Interactive map view (protected)

See `src/router/README.md` for routing documentation.

## Map Feature

Interactive map visualization of campaign worlds, locations, settlements, and structures using MapLibre GL JS.

### Features

- **GeoJSON Layer Rendering**: Displays locations (points and regions), settlements, and structures
- **Entity Popups**: Click entities to view detailed information with typed variables
- **Layer Controls**: Toggle visibility of different entity types
- **Time Scrubber**: View historical state of the world at different points in time
- **Loading & Error States**: Graceful handling of data loading and errors
- **Performance Optimized**: Handles 1000+ entities smoothly with memoization

### Usage

```tsx
import { Map } from '@/components/features/map';

function MapPage() {
  return (
    <Map
      initialCenter={[0, 0]}
      initialZoom={4}
      worldId="world-123"
      kingdomId="kingdom-456"
      campaignId="campaign-789"
    />
  );
}
```

### Components and Hooks

**Core Components:**

- `Map` - Main map component with viewport management
- `LayerControls` - Toggle layer visibility (locations, settlements, structures)
- `TimeScrubber` - View map state at different points in world time
- `LoadingSpinner`, `ErrorMessage`, `EmptyState` - UI states

**Layer Hooks:**

- `useLocationLayers` - Fetch and render location layers (points and regions)
- `useSettlementLayers` - Fetch and render settlement markers
- `useStructureLayers` - Fetch and render structure markers
- `useMapLayers` - Core hook for managing MapLibre layers and visibility
- `useEntityPopup` - Manage popup lifecycle with React portal rendering

**Utilities:**

- GeoJSON factory functions (createLocationPointFeature, createSettlementFeature, etc.)
- Time filtering utilities (filterByTime)
- Coordinate validation (prevents MapLibre crashes from invalid data)

### Architecture

**Coordinate Validation:**
All GeoJSON factory functions validate coordinates to prevent MapLibre crashes (checks for NaN, Infinity, null, undefined).

**Performance Optimizations:**

- useMemo for GeoJSON feature generation (prevents redundant processing)
- React.memo for presentational components (prevents cascading re-renders)
- DataLoader batching on backend (prevents N+1 queries)

**Time Filtering:**
Client-side filtering approach using createdAt, deletedAt, and archivedAt timestamps. Acceptable for MVP (1000+ entities).

### Testing

342 comprehensive tests covering all map functionality:

- Map component (23 tests)
- Layer hooks (70 tests)
- Popup components (19 tests)
- GeoJSON utilities (84 tests)
- Time filtering (49 tests)
- UI components (85 tests)
- MapPage (12 tests)

See `src/components/features/map/README.md` for complete documentation.

## Timeline View

Interactive timeline visualization of campaign events and encounters over world-time using vis-timeline.

### Features

- **Event/Encounter Visualization**: Display scheduled and occurred events/encounters on timeline
- **Color-Coded Status**: Visual status indicators (completed, scheduled, overdue, resolved, unresolved)
- **Current Time Marker**: Red vertical line showing campaign's current world time
- **Drag-to-Reschedule**: Drag items to new dates with validation (no past scheduling, locked completed items)
- **Zoom & Pan Controls**: Navigate through time with buttons or keyboard shortcuts (+/-, 0, T)
- **Filtering**: Filter by event type (story, kingdom, party, world) and status with URL persistence
- **Lane Grouping**: Group items by type (Events/Encounters) or location
- **Error Boundaries**: Graceful error handling with custom fallback UI
- **Performance Optimized**: Handles 500+ items with <5s rendering time

### Usage

```tsx
import { Timeline, TimelineControls, TimelineFilters } from '@/components/features/timeline';

function TimelinePage() {
  const timelineRef = useRef<TimelineHandle>(null);
  const { items } = useTimelineData(campaignId);

  return (
    <>
      <TimelineControls timelineRef={timelineRef} currentTime={currentTime} />
      <Timeline
        ref={timelineRef}
        items={items}
        currentTime={currentTime}
        onItemMove={handleReschedule}
      />
    </>
  );
}
```

### Components and Hooks

**Core Components:**

- `Timeline` - Main timeline wrapper for vis-timeline with React-friendly API
- `TimelineControls` - Zoom/pan control panel with keyboard shortcuts
- `TimelineFilters` - Filter panel for event types, status, and grouping
- `ErrorBoundary` - Reusable error boundary for catching rendering errors

**Hooks:**

- `useTimelineReschedule` - Handle drag-to-reschedule with validation and mutations
- `useEventsByCampaign` - Fetch events for campaign
- `useEncountersByCampaign` - Fetch encounters for campaign
- `useCurrentWorldTime` - Fetch current world time for marker

**Utilities:**

- `timeline-transforms.ts` - Transform GraphQL data to vis-timeline format with colors
- `timeline-validation.ts` - Validate reschedule operations
- `timeline-filters.ts` - Filter and group timeline items with URL serialization

### Architecture

**Data Flow:**

1. Fetch events and encounters from GraphQL
2. Apply client-side filters (event type, status)
3. Transform to vis-timeline format with color-coding
4. Apply lane grouping strategy
5. Render on timeline with current time marker

**Validation Rules:**

- Completed events cannot be rescheduled
- Resolved encounters cannot be rescheduled
- Items cannot be scheduled before current world time
- Validation occurs before GraphQL mutation

**Color Scheme:**

- Completed events: Green (#10b981)
- Scheduled events: Blue (#3b82f6)
- Overdue events: Red (#ef4444)
- Resolved encounters: Dark Green (#059669)
- Unresolved encounters: Orange (#f97316)

### Testing

192 comprehensive tests covering all timeline functionality:

- Transformation utilities (19 tests)
- Validation logic (11 tests)
- Filtering and grouping (51 tests)
- Reschedule hook (8 tests)
- GraphQL mutations (8 tests)
- Components (113 tests)

See `docs/features/timeline-view.md` for complete documentation.

## Entity Inspector

Comprehensive drawer component for inspecting and editing Settlement and Structure entities with tabbed interface.

### Features

- **6-Tab Interface**: Overview, Details, Links, Conditions, Effects, and Versions tabs
- **Overview Tab**: Basic entity info, computed fields, copy-to-clipboard functionality
- **Details Tab**: Entity-specific panels (SettlementPanel/StructurePanel) with typed variables
- **Links Tab**: Navigate between related entities with breadcrumb history
- **Conditions Tab**: View JSONLogic expressions with interactive evaluation trace modal
- **Effects Tab**: Grouped by timing phase (PRE/ON_RESOLVE/POST) with execution history
- **Versions Tab**: Audit trail timeline with before/after changes and operation badges
- **Inline Editing**: Edit entity names with keyboard shortcuts (Ctrl+S to save, Esc to cancel)
- **Entity Navigation**: Click related entities to navigate with breadcrumb trail and back button
- **Accessibility**: WCAG 2.1 Level AA compliant with full keyboard navigation
- **Responsive Design**: Mobile (3-column tabs) and desktop (6-column tabs) layouts

### Usage

```tsx
import { EntityInspector } from '@/components/features/entity-inspector';

function MapPage() {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string } | null>(null);

  const handleEntitySelect = (type: 'settlement' | 'structure', id: string) => {
    setSelectedEntity({ type, id });
    setInspectorOpen(true);
  };

  return (
    <>
      <Map onEntitySelect={handleEntitySelect} />
      <EntityInspector
        entityType={selectedEntity?.type}
        entityId={selectedEntity?.id}
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
      />
    </>
  );
}
```

### Components and Hooks

**Tab Components:**

- `OverviewTab` - Display basic info, computed fields, and name editing
- `SettlementPanel` - Settlement-specific attributes (kingdom, campaign, level) and typed variables
- `StructurePanel` - Structure-specific attributes (type, settlement, position, orientation) and typed variables
- `LinksTab` - Related entity navigation with breadcrumb UI
- `ConditionsTab` - Field conditions with JSONLogic expressions and priority sorting
- `EffectsTab` - Effects grouped by timing phase with execution history modal
- `VersionsTab` - Audit trail timeline with campaign-level authorization

**Supporting Components:**

- `ConditionExplanation` - Modal showing step-by-step condition evaluation trace
- `EffectExecutionHistory` - Modal displaying past effect executions with status and errors
- `EditableField` - Inline editing component supporting text, number, boolean, textarea types

**Hooks:**

- `useConditionsForEntity` - Fetch field conditions for an entity (instance and type-level)
- `useEvaluateCondition` - Evaluate condition with custom context and get trace
- `useAllEffectsForEntity` - Fetch effects from all timing phases in single query
- `useEntityAuditHistory` - Fetch audit trail for entity with campaign authorization
- `useEditMode` - Manage edit state, validation, dirty checking, and save operations

**GraphQL Queries:**

- `GET_CONDITIONS_FOR_ENTITY` - Fetch conditions with filtering
- `GET_EFFECTS_FOR_ENTITY` - Fetch effects by timing phase
- `EVALUATE_FIELD_CONDITION` - Evaluate condition with trace
- `GET_ENTITY_AUDIT_HISTORY` - Fetch audit trail (max 100 entries)

**GraphQL Mutations:**

- `updateSettlement` - Update settlement fields
- `updateStructure` - Update structure fields

### Architecture

**Edit Mode Infrastructure:**

- `useEditMode` hook manages edit state, validation, dirty checking, and auto-sync
- `EditableField` component provides type-specific inline editing (text, number, boolean, textarea)
- Ref-based save coordination between EntityInspector and tabs
- Unsaved changes protection with confirmation dialog
- Keyboard shortcuts (Ctrl+S to save, Esc to cancel)

**Navigation System:**

- Navigation stack tracks visited entities for back navigation
- Breadcrumb UI shows entity path with "›" separators
- Currently supports Settlement ↔ Structure navigation
- Kingdom/Location/Campaign navigation logged as TODO for future implementation

**Security:**

- Campaign-level authorization for audit history (owner/member only)
- EntityType whitelist (Settlement, Structure, Character, Event, Encounter)
- Generic error messages prevent user enumeration
- Protected fields (id, timestamps, ownership) in edit mode

**Performance:**

- React.memo optimization for tab components
- Cache-first GraphQL policies for details queries
- Lazy tab loading (only fetch data when tab is active)
- Loading skeletons for better perceived performance

### Testing

172 comprehensive tests covering all entity inspector functionality:

- EntityInspector core (12 tests) - Loading, error, tabs, navigation
- OverviewTab (20 tests) - Display, editing, clipboard, validation
- SettlementPanel (24 tests) - Attributes, variables, clipboard, formatting
- StructurePanel (25 tests) - Attributes, variables, clipboard, type fallback
- ConditionsTab (22 tests) - Display, sorting, badges, explain modal
- EffectsTab (23 tests) - Timing phases, priority, history modal
- VersionsTab (24 tests) - Timeline, operations, changes, security
- LinksTab (24 tests) - Navigation, keyboard, accessibility

See `docs/features/entity-inspector.md` and `src/components/features/entity-inspector/README.md` for complete documentation.

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

## Testing

The application has three layers of testing:

1. **Unit Tests** - Vitest for components, hooks, and utilities
2. **Integration Tests** - Vitest with MSW for GraphQL hooks and workflows
3. **E2E Tests** - Playwright for end-to-end user workflows

### Test Stack

- **Unit/Integration Runner**: Vitest (Vite-native, fast)
- **React Testing**: @testing-library/react
- **API Mocking**: MSW v2 (Mock Service Worker)
- **E2E Testing**: Playwright
- **Environment**: happy-dom (faster than jsdom)
- **Matchers**: @testing-library/jest-dom

### CI/CD Status

✅ **97.8% test success rate** (1,312/1,341 tests) in GitHub Actions CI

The frontend test suite uses a custom wrapper script to handle memory constraints in GitHub Actions runners (7GB total RAM). The configuration includes worker process recycling and graceful handling of memory exhaustion during cleanup phases.

**Memory Configuration:**

- 1GB wrapper process + 6GB worker heap
- Worker recycling enabled (`singleFork: false`) to prevent cross-file accumulation
- 29 tests in 1 file skipped due to cleanup-phase crash (acceptable for CI)

For the complete debugging saga and technical analysis of the memory optimization work, see [`../../docs/ci/memory-debugging-saga.md`](../../docs/ci/memory-debugging-saga.md).

### Running Tests

```bash
# Run all tests
pnpm --filter @campaign/frontend test

# Watch mode (recommended for development)
pnpm --filter @campaign/frontend test:watch

# Coverage report
pnpm --filter @campaign/frontend test -- --coverage
```

### Test Types

**Unit Tests** (Zustand stores):

```typescript
// auth-slice.test.ts
it('should log in user successfully', () => {
  const store = createTestStore();
  const user = { id: '1', email: 'test@example.com', role: 'player' };

  store.getState().login('token123', user);

  expect(store.getState().isAuthenticated).toBe(true);
  expect(store.getState().user).toEqual(user);
});
```

**Integration Tests** (GraphQL hooks):

```typescript
// settlements.test.tsx
it('should fetch settlements by kingdom', async () => {
  const { result } = renderHook(() => useSettlementsByKingdom('kingdom-1'), {
    wrapper: createApolloWrapper(),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.settlements).toHaveLength(2);
});
```

**MSW Mocking**:
MSW intercepts GraphQL requests at the network level for realistic integration testing:

```typescript
// graphql-handlers.ts
graphql.query('GetSettlementsByKingdom', ({ variables }) => {
  const settlements = mockSettlements.filter((s) => s.kingdomId === variables.kingdomId);
  return HttpResponse.json({ data: { settlementsByKingdom: settlements } });
});
```

### E2E Testing with Playwright

**Running E2E Tests:**

```bash
# Run all E2E tests (166 tests across 18 files)
pnpm --filter @campaign/frontend e2e

# Run with UI mode for debugging
pnpm --filter @campaign/frontend e2e:ui

# Run critical tests only
pnpm --filter @campaign/frontend e2e:critical

# Run specific test file
pnpm --filter @campaign/frontend exec playwright test e2e/auth.spec.ts
```

**Test Coverage:**

- 🔴 **Critical** (43 tests): Core functionality, auth, data integrity
- 🟡 **High Priority** (87 tests): Major features, common workflows
- 🟢 **Medium Priority** (32 tests): Edge cases, validation, polish
- 🔵 **Low Priority** (4 tests): Nice-to-have optimizations

**Key Test Areas:**

- Authentication & Authorization (7 tests)
- Dashboard & Navigation (5 tests)
- Map View & Interactions (12 tests)
- Flow View & Dependency Graph (11 tests)
- Timeline & Drag-to-Reschedule (12 tests)
- Entity Inspector & Editing (13 tests)
- Cross-View Selection (9 tests)
- Event & Encounter Resolution (9 tests)
- Branching & Merging (23 tests)
- Real-time Updates (4 tests)
- Error Handling (8 tests)
- Accessibility (9 tests)
- Performance & Mobile (11 tests)

**Comprehensive Documentation:**

- Test Guide: `e2e/README.md` - Setup, commands, test data reference
- Test Checklist: `e2e/PLAYWRIGHT_TESTING_CHECKLIST.md` - Detailed Gherkin-style scenarios
- CI Workflow: `.github/workflows/e2e-tests.yml` - GitHub Actions configuration

See `e2e/README.md` for comprehensive E2E testing documentation and `src/__tests__/README.md` for unit/integration testing patterns.

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

1. Check port 9263 is available (or set VITE_PORT to a different port)
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

## Docker Deployment

The frontend includes a multi-stage Dockerfile for production deployment with Nginx serving static assets.

### Building the Docker Image

```bash
# From project root
docker build -t campaign-frontend -f packages/frontend/Dockerfile .
```

The Dockerfile uses a multi-stage build:

1. **Builder stage**: Installs dependencies and builds the production bundle with Vite
2. **Production stage**: Nginx serves static files with gzip compression and security headers

### Running with Docker Compose

The frontend is included in the root `docker-compose.yml` configuration:

```bash
# Start all services (development mode)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Start all services (production mode)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up

# Start only frontend and API
docker compose up frontend api
```

### Environment Variables for Docker

The docker-compose configuration handles environment variable injection via `.env.local` file in project root.

**Key Variables:**

- `VITE_API_URL` - GraphQL endpoint (e.g., `http://api:9264/graphql`)
- `VITE_API_WS_URL` - WebSocket endpoint (e.g., `ws://api:9264/graphql`)
- `VITE_PORT` - Frontend port (default: 9263)
- `VITE_APP_NAME` - Application name
- `VITE_ENVIRONMENT` - Current environment (development/staging/production)

**Exposed Ports:**

- `9263` - Nginx HTTP server serving React app

**Health Checks:**

The container includes a health check that verifies Nginx is serving content:

```yaml
healthcheck:
  test: ['CMD', 'curl', '-f', 'http://localhost:9263/']
  interval: 30s
  timeout: 3s
  retries: 3
  start_period: 10s
```

**Nginx Configuration:**

The production container uses a custom Nginx configuration with:

- Gzip compression for text assets
- Cache headers for static assets (1 year for hashed files)
- SPA routing fallback (all routes serve index.html)
- Security headers (X-Frame-Options, X-Content-Type-Options)
- Access and error logging

### Production Build Optimization

The Vite build includes:

- Code splitting with React.lazy() for routes
- Tree-shaking to remove unused code
- Minification and compression
- CSS extraction and minification
- Asset hashing for cache busting
- Source maps (configurable)

## Related Documentation

- **Project Documentation**:
  - [Root README](../../README.md) - Project overview and setup guide
  - [CLAUDE.md](../../CLAUDE.md) - Development guidelines and workflow
  - [Frontend Development Guide](../../docs/development/frontend-guide.md) - Comprehensive frontend development guide

- **Feature Documentation** (in `../../docs/features/`):
  - [Map Editing Tools](../../docs/features/map-editing-tools.md) - Interactive map with GeoJSON layers
  - [Flow View](../../docs/features/flow-view.md) - Dependency graph visualization
  - [Timeline View](../../docs/features/timeline-view.md) - Event and encounter timeline
  - [Entity Inspector](../../docs/features/entity-inspector.md) - Entity inspection drawer
  - [Event & Encounter Resolution](../../docs/features/event-encounter-resolution.md) - Resolution workflow
  - [Cross-View Selection](../../docs/features/cross-view-selection.md) - Synchronized selection
  - [World Time System](../../docs/features/world-time-system.md) - Campaign time tracking
  - [Condition System](../../docs/features/condition-system.md) - Dynamic computed fields
  - [Dependency Graph System](../../docs/features/dependency-graph-system.md) - Relationship tracking
  - [Effect System](../../docs/features/effect-system.md) - World state mutations
  - [Branching System](../../docs/features/branching-system.md) - Alternate timeline branches
  - [Real-time Updates](../../docs/features/realtime-updates.md) - WebSocket integration

- **Package Documentation**:
  - [API Package](../api/README.md) - Backend GraphQL API
  - [Shared Package](../shared/README.md) - Shared types and utilities
  - [Rules Engine](../rules-engine/README.md) - Condition evaluation worker
  - [Scheduler](../scheduler/README.md) - Time-based operations worker

- **Internal Documentation** (in this package):
  - [API Client README](src/services/api/README.md) - GraphQL client and hooks
  - [Store README](src/stores/README.md) - Zustand state management
  - [Config README](src/config/README.md) - Environment configuration
  - [Router README](src/router/README.md) - React Router setup
  - [Testing README](src/__tests__/README.md) - Test setup and patterns
  - [Map Feature README](src/components/features/map/README.md) - Map component documentation
  - [Entity Inspector README](src/components/features/entity-inspector/README.md) - Inspector component documentation

## Contributing

Follow the TDD workflow:

1. Write failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Use TypeScript Fixer for type errors
5. Use Code Reviewer before committing

## License

[To be determined]
