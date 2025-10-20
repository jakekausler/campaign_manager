# Campaign Management Tool - Claude AI Development Guide

This file contains instructions and guidelines for Claude AI agents working on this project. This is separate from the README.md, which is user-facing documentation.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Development Commands](#development-commands)
4. [Testing Strategy](#testing-strategy)
5. [Code Quality](#code-quality)
6. [Git Commit Messages](#git-commit-messages)
7. [TypeScript Guidelines](#typescript-guidelines)
8. [Test-Driven Development (TDD)](#test-driven-development-tdd)
9. [Working with the Monorepo](#working-with-the-monorepo)
10. [Subagent Usage](#subagent-usage)
11. [Common Workflows](#common-workflows)
12. [Debugging](#debugging)
13. [Database Migrations](#database-migrations)

---

## Project Overview

This is a full-stack campaign management tool for tabletop RPGs built as a pnpm monorepo. The project uses:

- **Monorepo Manager**: pnpm workspaces
- **Backend**: NestJS (GraphQL API), Node workers (rules-engine, scheduler)
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL + PostGIS (to be set up in TICKET-003)
- **Testing**: Jest (backend), Vitest (frontend)
- **Code Quality**: ESLint, Prettier, Husky hooks

## Repository Structure

```
campaign_manager/
├── .claude/
│   ├── commands/          # Slash commands
│   └── agents/         # Specialized subagent definitions
├── packages/
│   ├── api/               # NestJS GraphQL API
│   ├── rules-engine/      # Rules evaluation worker
│   ├── scheduler/         # Event scheduling worker
│   ├── frontend/          # React application
│   └── shared/            # Shared types and utilities
├── plan/                  # Project planning and tickets
├── .github/workflows/     # CI/CD workflows
└── [config files]         # Root-level configuration
```

## Development Commands

**CRITICAL: NEVER CHANGE DIRECTORIES**

**ALWAYS run all commands from the project root directory** (`/storage/programs/campaign_manager`). Do NOT use `cd` to navigate into package directories. Use `pnpm --filter` to target specific packages instead.

### Root-Level Commands

Run from project root (`/storage/programs/campaign_manager`):

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Type-check all packages
pnpm run type-check

# Lint all packages
pnpm run lint

# Run all tests
pnpm run test

# Run tests in watch mode
pnpm run test:watch

# Format all code
pnpm run format

# Check formatting without fixing
pnpm run format:check

# Clean build artifacts
pnpm run clean

# Run all packages in dev mode (parallel)
pnpm run dev
```

### Package-Specific Commands

Run commands in a specific package:

```bash
# Run dev server for a package
pnpm --filter @campaign/api dev
pnpm --filter @campaign/frontend dev

# Build a specific package
pnpm --filter @campaign/api build

# Test a specific package
pnpm --filter @campaign/api test

# Type-check a specific package
pnpm --filter @campaign/api type-check

# Lint a specific package
pnpm --filter @campaign/api lint
```

## Testing Strategy

### Test Structure

Each package should have tests colocated with source files or in a `__tests__` directory:

```
packages/api/
├── src/
│   ├── users/
│   │   ├── users.service.ts
│   │   └── users.service.test.ts
│   └── __tests__/
│       └── integration/
```

### Running Tests

**IMPORTANT**: The base agent should NEVER run tests directly. Always use the TypeScript Tester subagent for all test-related operations.

```bash
# Commands below are for reference only - use TypeScript Tester subagent to run them

# Run all tests across all packages
pnpm run test

# Run tests for a specific package
pnpm --filter @campaign/api test

# Run tests in watch mode (for active development)
pnpm --filter @campaign/api test:watch

# Run tests with coverage
pnpm --filter @campaign/api test -- --coverage
```

### Test Naming Conventions

- Unit test files: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

## Code Quality

### Pre-Commit Checks

The project uses Husky hooks that run automatically:

- **pre-commit**: Runs `lint-staged` to lint and format changed files
- **pre-push**: Runs `type-check` and `test` on all packages

### Manual Quality Checks

Before committing, you can manually run:

```bash
# Check TypeScript compilation
pnpm run type-check

# Check linting
pnpm run lint

# Check formatting
pnpm run format:check

# Run all three
pnpm run type-check && pnpm run lint && pnpm run test
```

### Fixing Issues

**IMPORTANT**: Never attempt to fix TypeScript or linting errors directly. Always use the TypeScript Fixer subagent (see [Subagent Usage](#subagent-usage)).

```bash
# Auto-fix ESLint issues (via subagent)
pnpm run lint -- --fix

# Auto-format code
pnpm run format
```

## Git Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format with a detailed body.

### Structure

```
<type>(<scope>): <short summary>

<detailed body explaining WHY, implementation decisions, context>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes only
- **refactor**: Code changes that neither fix bugs nor add features
- **test**: Adding or updating tests
- **chore**: Changes to build process, dependencies, or tooling
- **perf**: Performance improvements
- **style**: Code style changes (formatting, missing semi-colons, etc.)

### Scopes

Use the package name as the scope:

- `api` - Changes to @campaign/api
- `frontend` - Changes to @campaign/frontend
- `shared` - Changes to @campaign/shared
- `rules-engine` - Changes to @campaign/rules-engine
- `scheduler` - Changes to @campaign/scheduler
- `root` - Changes to root-level config or multiple packages

### Commit Command Pattern

Use HEREDOC for multi-line messages:

```bash
git commit -m "$(cat <<'EOF'
feat(api): add user authentication endpoints

Implements JWT-based authentication flow with refresh tokens.
Added login, refresh, and logout endpoints using bcrypt for
password hashing. Tokens expire after 15 minutes (access) and
7 days (refresh).

Part of TICKET-004 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Key points:**

- Summary line: <72 chars, imperative mood, no period
- Body: Explain WHY, not just WHAT. Include implementation decisions and ticket references
- Always include Claude Code attribution footer

## TypeScript Guidelines

### Strict Mode

All packages use TypeScript strict mode. Key implications:

- All variables must have explicit or inferred types
- `null` and `undefined` must be handled explicitly
- `any` type should be avoided (use `unknown` if needed)
- Functions must have return types in some contexts

### Path Aliases

Use configured path aliases for imports:

```typescript
// Good
import { BaseEntity } from '@campaign/shared';

// Avoid
import { BaseEntity } from '../../../shared/src/types';
```

Available aliases:

- `@campaign/shared` → `packages/shared/src`
- `@campaign/api` → `packages/api/src`
- `@campaign/rules-engine` → `packages/rules-engine/src`
- `@campaign/scheduler` → `packages/scheduler/src`

### Type-Only Imports

Use type-only imports when importing only types:

```typescript
import type { User } from './types';
import { userService } from './service';
```

## Test-Driven Development (TDD)

### TDD Workflow

Follow the Red-Green-Refactor cycle:

1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up code while keeping tests green
4. **Repeat**: Move to the next piece of functionality

### When to Use TDD

**Always use TDD for:**

- New features or functionality
- Bug fixes (write failing test that reproduces the bug)
- Complex business logic
- Data transformations
- API endpoints

**TDD may not be necessary for:**

- Simple configuration changes
- Documentation updates
- Styling/UI tweaks (unless testing user interactions)

### Running Tests During TDD

**IMPORTANT**: The base agent should write tests and implementation code. Use the TypeScript Tester subagent ONLY to run and debug tests after you've written them.

```bash
# Commands below are for reference only - use TypeScript Tester subagent

# NEVER change directories - always run from root
# DON'T DO THIS: cd packages/api

# Start test watch mode for a specific package (from root)
pnpm --filter @campaign/api test:watch

# The tests will re-run automatically on file changes
```

## Working with the Monorepo

### Adding Dependencies

```bash
# Add to root (dev dependencies only)
pnpm add -D -w <package>

# Add to specific package
pnpm --filter @campaign/api add <package>

# Add dev dependency to specific package
pnpm --filter @campaign/api add -D <package>
```

### Cross-Package Dependencies

Packages can depend on each other. Add in `package.json`:

```json
{
  "dependencies": {
    "@campaign/shared": "workspace:*"
  }
}
```

Then run `pnpm install` to link the workspace dependency.

### Build Order

Some packages depend on others being built first:

1. `@campaign/shared` (no dependencies)
2. `@campaign/api`, `@campaign/rules-engine`, `@campaign/scheduler` (depend on shared)
3. `@campaign/frontend` (may use types from shared)

The `pnpm run build` command handles this automatically.

## Subagent Usage

**CRITICAL RULE FOR BASE AGENT**: The base agent must NEVER run tests, debug test failures, fix TypeScript errors, or fix linting errors directly. Always delegate these tasks to the appropriate specialized subagent.

### Available Subagents

#### TypeScript Tester (`/.claude/agents/typescript-tester.md`)

**Purpose**: Run and debug existing TypeScript tests; ensure code is fixed to match tests, not vice versa

**When to use**: Use this subagent ONLY for:

- Running existing tests (unit, integration, e2e)
- Debugging test failures
- Understanding why tests are failing
- Fixing implementation code to make existing tests pass

**DO NOT use this subagent for:**

- Writing new tests (base agent should write tests)
- Writing new implementation code (base agent should implement)
- Refactoring existing code (base agent should refactor)
- TDD development (base agent should write tests and code, this agent only runs them)

**CRITICAL RULES**:

1. The base agent should NEVER run or debug tests directly
2. The base agent SHOULD write new tests and implementation code directly
3. Only delegate to TypeScript Tester for RUNNING and DEBUGGING existing tests
4. The subagent fixes CODE to match tests, not tests to match broken code

**How to invoke**:

```
Use the Task tool with the typescript-tester subagent:
- description: "Run and debug tests for [package/feature]"
- prompt: "I've written tests for [feature] in [file path]. Please run the tests
  and if any fail, analyze the failures and fix the implementation code (not the
  tests) to make them pass while preserving the intended functionality."
- subagent_type: "typescript-tester"
```

**Example for test failures** (after base agent has written tests):

```
Use the Task tool with the typescript-tester subagent:
- description: "Fix failing tests in users service"
- prompt: "The following tests are failing in @campaign/api:

  FAIL packages/api/src/users/users.service.test.ts
    UserService
      ✕ should create user with valid data (15 ms)

  Expected: { id: '1', name: 'Alice', email: 'alice@example.com' }
  Received: { id: '1', name: 'Alice' }

  Please analyze the test to understand expected behavior and fix the implementation
  code to make the test pass."
- subagent_type: "typescript-tester"
```

#### TypeScript Fixer (`/.claude/agents/typescript-fixer.md`)

**Purpose**: Fix TypeScript compilation and ESLint errors

**When to use**: ALWAYS use this subagent when encountering:

- TypeScript compilation errors
- ESLint errors or warnings
- Type mismatches
- Import/export errors
- Module resolution problems

**CRITICAL RULE**: The base agent should NEVER attempt to fix TypeScript or linting errors directly. Always delegate to this subagent.

**How to invoke**:

```
Use the Task tool with the typescript-fixer subagent:
- description: "Fix TypeScript errors in [package/file]"
- prompt: "I'm encountering the following TypeScript/ESLint errors in [package]:
  [paste error output]

  Please read the affected files, fix the errors, and verify the fixes by running type-check and lint."
- subagent_type: "typescript-fixer"
```

**Example**:

When you run `pnpm run type-check` and see errors like:

```
packages/api/src/users/users.service.ts:15:5 - error TS2322: Type 'string' is not assignable to type 'number'.
```

Immediately delegate to the TypeScript Fixer subagent instead of trying to fix it yourself.

#### Code Reviewer (`/.claude/agents/code-reviewer.md`)

**Purpose**: Review code changes for best practices, security vulnerabilities, performance issues, and complexity overhead

**When to use**: **MANDATORY** before every commit with code changes

- Before committing any code changes
- After implementing features or bug fixes
- When refactoring code
- Before any git commit

**CRITICAL RULE**: The base agent must **ALWAYS** use this subagent before committing code changes.

**How to invoke**:

```
Use the Task tool with the code-reviewer subagent:
- description: "Review code changes before commit"
- prompt: "Please review the code changes that are staged for commit. Analyze for:
  1. Best practices and code quality
  2. Security vulnerabilities
  3. Performance issues
  4. Unnecessary complexity
  5. Type safety and error handling
  6. Project convention adherence

  Provide specific feedback with file paths and line numbers. Flag any critical
  issues that must be addressed before commit."
- subagent_type: "code-reviewer"
```

**What it checks**:

- Security (hardcoded secrets, SQL injection, XSS, etc.)
- Performance (N+1 queries, inefficient algorithms, memory leaks)
- Code quality (SRP, DRY, naming, complexity)
- Best practices (project conventions, error handling, tests)
- Maintainability (readability, coupling, testability)

#### Project Manager (`/.claude/agents/project-manager.md`)

**Purpose**: Verify implemented code matches ticket requirements and acceptance criteria

**When to use**: **MANDATORY** before marking a ticket as complete

- Before marking a ticket as completed
- Before updating ticket status to "done"
- After all implementation work is finished
- Before updating EPIC.md

**CRITICAL RULE**: The base agent must **ALWAYS** use this subagent before closing a ticket.

**How to invoke**:

```
Use the Task tool with the project-manager subagent:
- description: "Verify TICKET-XXX completion"
- prompt: "I've completed work on TICKET-XXX. Please review the ticket requirements
  in plan/TICKET-XXX.md and verify that the implemented code meets all:
  1. Scope of work items
  2. Acceptance criteria
  3. Technical requirements
  4. Testing requirements

  Confirm whether the ticket is ready to be marked as complete or if there
  are missing items."
- subagent_type: "project-manager"
```

**What it verifies**:

- All scope of work items are addressed
- All acceptance criteria are met
- Technical requirements are implemented
- Required tests are written and passing
- Documentation is updated as required
- No missing functionality

#### Prisma Database Debugger (`/.claude/agents/prisma-debugger.md`)

**Purpose**: Debug and fix Prisma ORM and database-related issues

**When to use**: Use this subagent for:

- Prisma Client errors and query issues
- Prisma schema validation errors
- Database migration errors (`prisma migrate` failures)
- Database connection issues
- Schema model relationship problems
- Database constraint violations
- Type generation issues (`prisma generate` failures)
- Prisma introspection errors
- Database sync issues between schema and actual database

**How to invoke**:

```
Use the Task tool with the prisma-debugger subagent:
- description: "Fix Prisma/database error in [package]"
- prompt: "I'm encountering the following Prisma/database error:
  [paste error output]

  Please analyze the issue, fix the schema/migrations/client usage as needed,
  and verify the fix."
- subagent_type: "prisma-debugger"
```

**What it handles**:

- Prisma Schema Language (PSL) issues
- Migration workflow problems
- Database connection and pooling issues
- Relation field configuration
- PostGIS and spatial data with Prisma
- Seeding and introspection issues
- Docker database environment issues

#### Ticket Navigator (`/.claude/agents/ticket-navigator.md`)

**Purpose**: Quickly determine the next incomplete ticket and stage from the project plan

**When to use**: Use this subagent when:

- Starting work with `/next_ticket` slash command
- Checking which ticket/stage to work on next
- Verifying completion status of tickets
- Need to know current progress in project plan

**How to invoke**:

```
Use the Task tool with the general-purpose subagent:
- description: "Find next ticket and stage"
- prompt: "Please read plan/EPIC.md to find the next incomplete ticket.
  Then check if a TICKET-###-implementation-plan.md exists for that ticket.
  If it does, determine the next incomplete stage.

  Report your findings in this exact format:

  Next Ticket: TICKET-###
  Title: [ticket title]
  Implementation Plan: [EXISTS | DOES NOT EXIST]
  Next Stage: [stage name if plan exists, otherwise N/A]

  Do not add any additional commentary or explanation."
- subagent_type: "general-purpose"
```

**Output format**: Concise 4-line format with no fluff

**Integration**: Used by `/next_ticket` slash command to determine what to work on next

### Creating New Subagents

If you need a specialized subagent for a recurring task:

1. Create a markdown file in `.claude/agents/`
2. **REQUIRED**: Add YAML frontmatter header at the top:
   ```yaml
   ---
   name: subagent-name
   description: Brief description of what the subagent does.
   ---
   ```
3. Define the purpose, capabilities, and usage
4. Update this CLAUDE.md file to document it

**Frontmatter Header Format**:

- `name`: kebab-case name matching the filename (without .md)
- `description`: One sentence describing the subagent's purpose
- Must be enclosed in `---` delimiters

## Common Workflows

### Starting a New Ticket

1. Read the ticket from `plan/TICKET-XXX.md`
2. Create an implementation plan using TodoWrite
3. If TDD is appropriate, write tests directly
4. Implement the feature incrementally
5. Delegate quality checks to subagents:
   - Use TypeScript Fixer for type-check and lint
   - Use TypeScript Tester for running existing tests and debugging failures
6. If errors occur:
   - TypeScript/ESLint errors → TypeScript Fixer subagent
   - Test failures → TypeScript Tester subagent (to run and debug only)
7. **Stage changes** with `git add`
8. **MANDATORY: Use Code Reviewer subagent** to review staged changes before commit
9. Address any critical issues flagged by Code Reviewer
10. Commit changes with detailed conventional commit message (only after Code Reviewer approval)
11. **MANDATORY: Use Project Manager subagent** to verify ticket completion
12. Address any missing items flagged by Project Manager
13. Update the ticket file with implementation notes and commit hash (only after Project Manager approval)
14. Update `plan/EPIC.md` to mark ticket as complete

### Adding a New Feature (TDD Approach)

1. **Write the test first** (Red) - Base agent writes test
   ```
   - Write a failing test that describes expected behavior
   - Use TypeScript Tester to run the test and verify it fails
   ```
2. **Implement minimal code** (Green) - Base agent implements
   ```
   - Write minimal implementation code to make test pass
   - Use TypeScript Tester to run tests and verify they pass
   ```
3. **Refactor** - Base agent refactors, TypeScript Tester verifies
   ```
   - Clean up code while keeping tests green
   - Use TypeScript Tester to verify tests still pass
   ```
4. **Verify quality** - Delegate to subagents
   ```
   - TypeScript Fixer: type-check and lint
   - TypeScript Tester: run all tests
   ```
5. **Commit with detailed message**
   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
   feat(api): add user creation feature
   ```

Implements complete user creation flow with validation:

- Email format validation and uniqueness check
- Password strength requirements (min 8 chars, complexity rules)
- Automatic timestamp generation for createdAt/updatedAt
- Returns user object without sensitive fields

Includes unit tests for validation logic and service methods.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

```

### Fixing a Bug

1. **Write a failing test that reproduces the bug** - Base agent writes test
```

- Write a test that reproduces the bug (should fail)
- Use TypeScript Tester to run test and verify it fails

```
2. **Fix the bug** - Base agent fixes, TypeScript Tester verifies
```

- Implement bug fix
- Use TypeScript Tester to run tests and verify test now passes

```
3. **Verify no regressions** - Delegate to subagents
```

- TypeScript Tester: run all tests
- TypeScript Fixer: type-check

````
4. **Commit with detailed message**
```bash
git commit -m "$(cat <<'EOF'
fix(api): correct user validation logic

Fixed validation bug where empty strings were accepted as valid
email addresses. Now properly validates email format using regex
and rejects empty/whitespace-only strings.

Added test case to prevent regression of this issue.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
````

### Adding a New Package

1. Create directory: `packages/new-package/`
2. Create `package.json` with name `@campaign/new-package`
3. Create `tsconfig.json` extending `../../tsconfig.base.json`
4. Add scripts: build, dev, test, lint, type-check
5. Add to workspace: `pnpm install`
6. Update this documentation

## Debugging

### TypeScript Errors

**DO NOT debug TypeScript errors directly. Use the TypeScript Fixer subagent.**

```bash
# Get detailed error information
pnpm run type-check

# Check specific package
pnpm --filter @campaign/api type-check
```

### Test Failures

**DO NOT debug test failures directly. Use the TypeScript Tester subagent.**

The TypeScript Tester subagent will:

- Run tests with appropriate verbosity
- Analyze test failures
- Fix implementation code to match test expectations
- Preserve intended functionality
- Verify fixes don't cause regressions

```bash
# Commands below are for reference only - use TypeScript Tester subagent

# Run tests with verbose output
pnpm --filter @campaign/api test -- --verbose

# Run specific test file
pnpm --filter @campaign/api test -- users.test.ts

# Run tests with debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Linting Issues

**DO NOT fix linting issues directly. Use the TypeScript Fixer subagent.**

```bash
# See detailed lint errors
pnpm run lint

# Check specific package
pnpm --filter @campaign/api lint
```

### Build Failures

```bash
# Clean and rebuild
pnpm run clean
pnpm install
pnpm run build

# Build specific package
pnpm --filter @campaign/shared build
```

## Database Migrations

The project uses Prisma for database schema management and migrations.

**IMPORTANT**: For all Prisma/database errors, use the Prisma Database Debugger subagent.

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

## Map Editing Tools

Interactive drawing and editing tools for map geometries (points and polygons). See [detailed documentation](docs/features/map-editing-tools.md).

**Quick Reference:**

- Components: `DrawControl`, `DrawToolbar`, `UndoRedoControls` in `packages/frontend/src/components/features/map/`
- Hook: `useMapDraw` for state management with undo/redo
- Utilities: `geometry.ts`, `geometry-validation.ts` in `packages/frontend/src/utils/`
- GraphQL: `updateLocationGeometry` mutation for persisting edits
- Key Features: Point/polygon drawing, edit mode, geometry validation (Turf.js), undo/redo (50 operations), keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z)
- Validation: Coordinate bounds, minimum vertices, self-intersection detection, area limits (1 m² - 10,000 km²)
- Integration: MapLibre GL Draw library with custom styling, optimistic locking via version field
- Implementation: TICKET-020 (8 stages, commits: aec1738 - 3f1fe15)

**TICKET-020: Map Editing Tools** (8 stages):

1. Setup MapLibre GL Draw with custom blue theme styling
2. Point Creation Tool with save/cancel workflow
3. Polygon Drawing Tool with real-time vertex count and area display
4. Geometry Validation using Turf.js for self-intersection detection
5. Edit Mode for Existing Geometry with vertex manipulation
6. Save/Cancel Workflow with backend persistence and optimistic locking
7. Undo/Redo for Edits with 50-operation history and keyboard shortcuts
8. Testing and Documentation

See `plan/TICKET-020.md` for detailed implementation notes and commit hashes.

## Flow View

Interactive flowchart visualization for exploring dependency graphs. See [detailed documentation](docs/features/flow-view.md).

**Quick Reference:**

- Page: `FlowViewPage` in `packages/frontend/src/pages/`
- Components: Custom nodes/edges, `FilterPanel`, `SelectionPanel`, `FlowToolbar`, `FlowControls` in `packages/frontend/src/components/features/flow/`
- Hook: `useDependencyGraph` for GraphQL query
- Utilities: `graph-layout.ts`, `graph-selection.ts`, `graph-filters.ts`, `node-navigation.ts` in `packages/frontend/src/utils/`
- GraphQL: `getDependencyGraph` query from Dependency Graph API
- Key Features: Auto-layout (Dagre), node/edge filtering, search, selection highlighting, cycle detection, multi-select, keyboard shortcuts
- Node Types: VARIABLE (green), CONDITION (blue), EFFECT (orange), ENTITY (purple)
- Edge Types: READS (solid), WRITES (dashed/animated), DEPENDS_ON (dotted)
- Performance: <2s for 100 nodes, <3s for 200 nodes, <5s for 500 nodes
- Integration: React Flow library, MiniMap, Controls, zoom indicator, loading skeleton
- Implementation: TICKET-021 (12 stages, commits: 66d4238 - ea4f9e0)

**TICKET-021: Flow View with React Flow** (12 stages):

1. Install and Configure React Flow (React Flow + CSS imports)
2. Create GraphQL Integration (`useDependencyGraph` hook, MSW handlers)
3. Transform Graph Data to React Flow Format (Dagre auto-layout)
4. Create Custom Node Components (VariableNode, ConditionNode, EffectNode, EntityNode)
5. Create Custom Edge Components (ReadsEdge, WritesEdge, DependsOnEdge)
6. Implement Auto-Layout Algorithm (Re-layout button, React Flow state management)
7. Add Minimap and Controls (FlowControls component with zoom indicator)
8. Implement Selection and Highlighting (BFS traversal, SelectionPanel, keyboard support)
9. Add Node Editing Integration (Double-click handler, route infrastructure)
10. Performance Optimization (React.memo, loading skeleton, performance tests)
11. Add Filtering and Search (FilterPanel, DFS cycle detection, multi-filter support)
12. Testing and Documentation (639 tests passing, accessibility audit, feature docs)

See `plan/TICKET-021.md` for detailed implementation notes and commit hashes.

## Timeline View

Interactive timeline visualization for events and encounters over campaign world-time. See [detailed documentation](docs/features/timeline-view.md).

**Quick Reference:**

- Page: `TimelinePage` at `/timeline` route in `packages/frontend/src/pages/`
- Components: `Timeline`, `TimelineControls`, `TimelineFilters`, `ErrorBoundary` in `packages/frontend/src/components/`
- Hooks: `useTimelineReschedule`, `useEventsByCampaign`, `useEncountersByCampaign` in `packages/frontend/src/hooks/` and `services/api/hooks/`
- Utilities: `timeline-transforms.ts`, `timeline-validation.ts`, `timeline-filters.ts` in `packages/frontend/src/utils/`
- GraphQL: `GET_EVENTS_BY_CAMPAIGN`, `GET_ENCOUNTERS_BY_CAMPAIGN` queries; `updateEvent`, `updateEncounter` mutations
- Key Features: Drag-to-reschedule, color-coded status (completed, scheduled, overdue, resolved), current time marker, zoom/pan controls, keyboard shortcuts (+/-, 0, T)
- Filtering: Event types (story, kingdom, party, world), status filters, lane grouping (type, location), URL persistence
- Validation: No past scheduling, completed/resolved items locked, optimistic UI with rollback
- Performance: 0.58ms for 100 items, 0.37ms for 200 items, 0.91ms for 500 items (4,000-8,000x faster than thresholds)
- Integration: vis-timeline library, GraphQL mutations with cache invalidation, error boundaries
- Implementation: TICKET-022 (12 stages, commits: 3273623 - [Stage 12 commit])

**TICKET-022: Timeline View Implementation** (12 stages):

1. Install vis-timeline and create Timeline wrapper component
2. Create GraphQL hooks for events and encounters
3. Create data transformation utilities (events/encounters → timeline items)
4. Implement useTimelineData hook for fetching and combining data
5. Create TimelinePage with basic visualization
6. Add current world time marker (red vertical line)
7. Implement zoom and pan controls with keyboard shortcuts
8. Add availability color coding (completed proactively in Stage 3)
9. Implement backend support for encounter scheduling (scheduledAt field)
10. Implement drag-to-reschedule functionality with validation
11. Add filtering and lane grouping with URL persistence
12. Testing, Documentation, and Polish (868 tests passing, performance benchmarks, accessibility audit, error boundaries, feature docs)

See `plan/TICKET-022.md` for detailed implementation notes and commit hashes.

## World Time System

Campaign-specific time tracking with custom calendars. See [detailed documentation](docs/features/world-time-system.md).

**Quick Reference:**

- Service: `WorldTimeService` in `packages/api/src/graphql/services/world-time.service.ts`
- Resolver: `WorldTimeResolver` in `packages/api/src/graphql/resolvers/world-time.resolver.ts`
- GraphQL: `getCurrentWorldTime` (query), `advanceWorldTime` (mutation)
- Key Features: Custom calendars, optimistic locking, time-travel queries
- Implementation: TICKET-010 (Commits: 3934e7c - 5e7fe2f)

## Condition System

Dynamic computed fields for entities using JSONLogic expressions. See [detailed documentation](docs/features/condition-system.md).

**Quick Reference:**

- Model: `FieldCondition` in `packages/api/prisma/schema.prisma`
- Services: `ConditionEvaluationService`, `ConditionService` in `packages/api/src/graphql/services/`
- Resolver: `FieldConditionResolver` in `packages/api/src/graphql/resolvers/`
- GraphQL: `createFieldCondition`, `updateFieldCondition`, `listFieldConditions`, `evaluateFieldCondition`
- Key Features: Instance/type-level conditions, priority-based evaluation, evaluation traces, JSONLogic expressions (max depth: 10)
- Integration: Settlement/Structure `computedFields` field resolver
- Implementation: TICKET-012 (Commits: 4377bae - 039ddd6)

---

## Dependency Graph System

Tracks relationships between conditions, variables, and effects for dependency analysis and cache invalidation. See [detailed documentation](docs/features/dependency-graph-system.md).

**Quick Reference:**

- Core: `DependencyGraph`, `DependencyExtractor` in `packages/api/src/graphql/utils/`
- Services: `DependencyGraphBuilderService`, `DependencyGraphService` in `packages/api/src/graphql/services/`
- Resolver: `DependencyGraphResolver` in `packages/api/src/graphql/resolvers/`
- GraphQL: `getDependencyGraph`, `getNodeDependencies`, `validateDependencyGraph`, `getEvaluationOrder`
- Key Features: Cycle detection (DFS), topological sort (Kahn's algorithm), automatic cache invalidation, in-memory caching
- Integration: Auto-invalidates on ConditionService/StateVariableService mutations
- Implementation: TICKET-014 (Commits: 82b5bf1 - 7ad6abb)

---

## Rules Engine Service Worker

Dedicated NestJS microservice for high-performance condition evaluation with caching and dependency ordering. See [detailed documentation](docs/features/rules-engine-worker.md).

**Quick Reference:**

- Location: Root level (not in packages/ directory)
- gRPC Service: `proto/rules-engine.proto` (port 50051)
- Services: `EvaluationEngineService`, `DependencyGraphService`, `CacheService`, `RedisService`
- API Integration: `RulesEngineClientService` in `packages/api/src/grpc/`
- Key Features: gRPC server, Redis pub/sub, in-memory caching (TTL: 300s), circuit breaker pattern, graceful degradation
- Performance: Cached <5ms, uncached <50ms (p95)
- Integration: Settlement/Structure `getComputedFields()` with automatic fallback
- Implementation: TICKET-015 (Commits: 3717b35 - ce8a51e)

---

## Effect System

Events/encounters mutate world state when they resolve using JSON Patch operations. See [detailed documentation](docs/features/effect-system.md).

**Quick Reference:**

- Models: `Effect`, `EffectExecution` in `packages/api/prisma/schema.prisma`
- Services: `EffectService`, `EffectExecutionService`, `EffectPatchService` in `packages/api/src/graphql/services/`
- Resolver: `EffectResolver` in `packages/api/src/graphql/resolvers/`
- GraphQL: `createEffect`, `executeEffect`, `listEffects`, `resolveEncounter` (mutation), `completeEvent` (mutation)
- Key Features: 3-phase execution (PRE/ON_RESOLVE/POST), JSON Patch (RFC 6902), path whitelisting, priority-based ordering, audit trail via EffectExecution
- Integration: `EncounterService.resolve()`, `EventService.complete()` with automatic effect execution, dependency graph tracking
- Security: Protected fields (id, timestamps, ownership), campaign authorization, role-based mutations (owner/gm only)
- Implementation: TICKET-016 (Commits: 7d1439d - c2e0b90)

---

## Quick Reference Card

### Most Common Commands

```bash
# Development
pnpm install                          # Install all dependencies
pnpm run dev                          # Run all packages in dev mode
pnpm --filter @campaign/api dev       # Run specific package

# Testing (TDD)
pnpm --filter @campaign/api test:watch  # Watch mode for TDD
pnpm run test                           # Run all tests

# Quality Checks
pnpm run type-check                   # Check TypeScript
pnpm run lint                         # Check ESLint
pnpm run format                       # Format code

# Build
pnpm run build                        # Build all packages
```

### Error Handling Rules

- **TypeScript errors** → Use TypeScript Fixer subagent
- **ESLint errors** → Use TypeScript Fixer subagent
- **Test failures** → Use TypeScript Tester subagent to run and debug (NEVER run directly)
- **Need to run tests** → Use TypeScript Tester subagent (NEVER run directly)
- **Need to write tests** → Write directly
- **Prisma/database errors** → Use Prisma Database Debugger subagent
- **Before committing code** → **MANDATORY:** Use Code Reviewer subagent
- **Before closing ticket** → **MANDATORY:** Use Project Manager subagent
- **Runtime errors** → Debug directly (unless Prisma/database related)
- **Build failures** → Check dependencies, use TypeScript Fixer if type-related

---

## Important Reminders

1. **NEVER change directories - ALWAYS run all commands from the project root**
2. **ALWAYS use TDD when implementing new features**
3. **NEVER fix TypeScript/ESLint errors directly - use the TypeScript Fixer subagent**
4. **NEVER run or debug tests directly - use the TypeScript Tester subagent**
5. **Write new tests directly - TypeScript Tester only runs/debugs**
6. **MANDATORY: ALWAYS use Code Reviewer subagent before committing code**
7. **MANDATORY: ALWAYS use Project Manager subagent before closing tickets**
8. **Delegate to specialized subagents**: TypeScript Tester for running/debugging tests, TypeScript Fixer for types/linting, Code Reviewer before commits, Project Manager before ticket closure
9. **Use conventional commit format with detailed messages explaining WHY**
10. **Update ticket files and EPIC.md when completing work (only after Project Manager approval)**
11. **Use TodoWrite to track complex tasks**
12. **Read existing code patterns before implementing new features**

---

## Getting Help

- Check `plan/` directory for ticket details and project roadmap
- Read `README.md` for user-facing setup instructions
- Check `.claude/commands/` for available slash commands
- Review existing tests for testing patterns (via TypeScript Tester subagent)
- Use the TypeScript Fixer subagent for all type/lint errors
- Use the TypeScript Tester subagent for all test-related work

## Subagent Decision Tree

When you encounter an issue, use this decision tree:

```
Are you about to commit code?
├─ YES → **MANDATORY:** Use Code Reviewer subagent FIRST
│        Only commit after approval
│
Are you about to mark a ticket as complete?
├─ YES → **MANDATORY:** Use Project Manager subagent FIRST
│        Only close ticket after approval
│
Is it a test failure or need to run tests?
├─ YES → Use TypeScript Tester subagent to RUN and DEBUG
│
Do you need to write new tests?
├─ YES → Write tests directly
│
Is it a TypeScript compilation error?
├─ YES → Use TypeScript Fixer subagent
│
Is it an ESLint error?
├─ YES → Use TypeScript Fixer subagent
│
Is it a module resolution or import error?
├─ YES → Use TypeScript Fixer subagent
│
Is it a Prisma/database error?
├─ YES → Use Prisma Database Debugger subagent
│
Is it a runtime logic error or bug?
├─ YES → Debug directly, write test to prevent regression
│
Is it a feature implementation task?
├─ YES → Write tests and implementation directly,
│        use TypeScript Tester to run tests,
│        use TypeScript Fixer for type/lint verification,
│        use Code Reviewer before commit,
│        use Project Manager before closing ticket
│
Otherwise → Handle directly or create new specialized subagent
```
