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
