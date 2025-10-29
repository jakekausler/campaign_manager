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
14. [Frontend Development](#frontend-development)
15. [Feature Documentation](#feature-documentation)
16. [Quick Reference Card](#quick-reference-card)
17. [Important Reminders](#important-reminders)
18. [Getting Help](#getting-help)
19. [Subagent Decision Tree](#subagent-decision-tree)

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

### Available Subagents (Summary)

| Subagent          | Purpose                             | When to Use                             |
| ----------------- | ----------------------------------- | --------------------------------------- |
| TypeScript Tester | Run and debug existing tests        | Test failures, need to run tests        |
| TypeScript Fixer  | Fix TypeScript/ESLint errors        | Type errors, lint errors, import issues |
| Code Reviewer     | **MANDATORY** before commits        | Every commit with code changes          |
| Project Manager   | **MANDATORY** before ticket closure | Every ticket completion                 |
| Prisma Debugger   | Prisma/database issues              | Schema, migration, query errors         |
| Ticket Navigator  | Find next incomplete work           | `/next_ticket` command                  |

**Invocation Pattern (All Subagents):**

```

Use Task tool with subagent_type: "<name>"

- description: "Brief action description"
- prompt: "[Detailed context and expectations]"

```

**Example - Code Reviewer (MANDATORY before every commit):**

```

Use Task tool with code-reviewer subagent:

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

**See [docs/development/subagent-guide.md](docs/development/subagent-guide.md) for detailed examples and patterns for each subagent.**

**For help choosing the right subagent, see the [Subagent Decision Tree](#subagent-decision-tree) section.**

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

**Quick Start:**

```bash
pnpm --filter @campaign/frontend dev  # Dev server on port 9263
pnpm --filter @campaign/frontend test # Run tests with Vitest
```

**See [docs/development/frontend-guide.md](docs/development/frontend-guide.md) for complete guide including:**

- Tech stack details (React 18, Vite 5, Apollo Client, Zustand)
- Project structure and architecture
- Development workflow and environment setup
- Common tasks (adding pages, components, GraphQL operations)
- Testing with Vitest and MSW
- Troubleshooting and best practices

## Feature Documentation

Complete feature documentation available in `docs/features/` and `docs/development/`:

- **Frontend Development** - React/Vite/TypeScript setup, architecture, common tasks → [docs/development/frontend-guide.md](docs/development/frontend-guide.md)
- **Map Editing Tools** - Interactive drawing and editing for map geometries → [docs/features/map-editing-tools.md](docs/features/map-editing-tools.md)
- **Flow View** - Interactive flowchart visualization for dependency graphs → [docs/features/flow-view.md](docs/features/flow-view.md)
- **Timeline View** - Interactive timeline for events and encounters → [docs/features/timeline-view.md](docs/features/timeline-view.md)
- **Entity Inspector** - Comprehensive drawer for inspecting/editing entities → [docs/features/entity-inspector.md](docs/features/entity-inspector.md)
- **Event & Encounter Resolution** - Resolution workflow for completing events and encounters → [docs/features/event-encounter-resolution.md](docs/features/event-encounter-resolution.md)
- **Cross-View Selection** - Synchronized entity selection across Map/Flow/Timeline → [docs/features/cross-view-selection.md](docs/features/cross-view-selection.md)
- **World Time System** - Campaign-specific time tracking with custom calendars → [docs/features/world-time-system.md](docs/features/world-time-system.md)
- **Condition System** - Dynamic computed fields using JSONLogic expressions → [docs/features/condition-system.md](docs/features/condition-system.md)
- **Dependency Graph System** - Tracks relationships for dependency analysis → [docs/features/dependency-graph-system.md](docs/features/dependency-graph-system.md)
- **Rules Engine Worker** - High-performance condition evaluation microservice → [docs/features/rules-engine-worker.md](docs/features/rules-engine-worker.md)
- **Scheduler Service** - Time-based operations and periodic events microservice → [docs/features/scheduler-service.md](docs/features/scheduler-service.md)
- **Effect System** - World state mutation via JSON Patch operations → [docs/features/effect-system.md](docs/features/effect-system.md)
- **Branching System** - Alternate timeline branches for "what-if" scenarios with fork/merge → [docs/features/branching-system.md](docs/features/branching-system.md)

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
