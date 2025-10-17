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

### Commit Message Format

All commits must follow the Conventional Commits format with a detailed body explaining the changes.

**Structure**:

```
<type>(<scope>): <short summary>

<detailed message explaining the why and what>

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

### Writing Good Commit Messages

**Summary Line** (first line):

- Keep under 72 characters
- Use imperative mood ("add feature" not "added feature")
- Don't end with a period
- Be specific but concise

**Detailed Message** (body):

- Explain WHY the change was made, not just WHAT changed
- Include context about the problem being solved
- Mention any important implementation decisions
- Reference ticket numbers if applicable
- Use bullet points for multiple changes
- Leave a blank line between summary and body

### Examples

**Good commit with detailed message**:

```
feat(api): add user authentication endpoints

Implements JWT-based authentication flow with refresh tokens.
Added three new endpoints:
- POST /auth/login - Issues access and refresh tokens
- POST /auth/refresh - Exchanges refresh token for new access token
- POST /auth/logout - Invalidates refresh token

Uses bcrypt for password hashing with cost factor of 12.
Tokens expire after 15 minutes (access) and 7 days (refresh).

Implements requirements from TICKET-004.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Good bug fix commit**:

```
fix(api): prevent race condition in event scheduler

Fixed a race condition where multiple workers could pick up
the same scheduled event for processing.

Added a database-level lock using PostgreSQL's SELECT FOR UPDATE
to ensure atomic event claiming. Also added a processed_at timestamp
to track when events were actually executed.

This resolves the duplicate event execution issue reported in
production logs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Good refactor commit**:

```
refactor(api): extract campaign validation into separate service

Moved campaign validation logic from CampaignController into
a dedicated CampaignValidationService to improve testability
and separation of concerns.

The validation rules are now easier to test in isolation and
can be reused by the GraphQL resolvers and REST endpoints.
No behavior changes - existing tests still pass.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Bad commit (too brief)**:

```
fix: bug fix
```

**Bad commit (unclear)**:

```
feat(api): update stuff

Changed some files
```

### Using Git Commit in Practice

When committing through the automated git workflow:

1. The commit message should be passed via HEREDOC for proper formatting
2. Include the Claude Code attribution footer
3. Ensure the message is clear enough for team members to understand

Example command:

```bash
git commit -m "$(cat <<'EOF'
feat(api): add GraphQL mutation for campaign creation

Implements createCampaign mutation that:
- Validates campaign data against schema rules
- Creates campaign with default settings
- Associates campaign with authenticated user
- Returns created campaign with all fields

Includes comprehensive unit tests for validation logic
and integration tests for the GraphQL mutation.

Part of TICKET-006 implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Commit Message Checklist

Before committing, verify:

- [ ] Type and scope are correct
- [ ] Summary is clear and under 72 characters
- [ ] Body explains WHY, not just WHAT
- [ ] Important implementation details are mentioned
- [ ] Related ticket numbers are referenced
- [ ] Claude Code attribution is included
- [ ] Message would be clear to someone reviewing in 6 months

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
   ```bash
   pnpm --filter @campaign/api test:watch
   ```
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up code while keeping tests green
4. **Repeat**: Move to the next piece of functionality

### TDD Example

```typescript
// 1. RED - Write the test first (users.service.test.ts)
describe('UserService', () => {
  it('should create a new user', async () => {
    const user = await userService.create({ name: 'Alice', email: 'alice@example.com' });
    expect(user).toHaveProperty('id');
    expect(user.name).toBe('Alice');
  });
});

// Run test - it should fail
// pnpm run test

// 2. GREEN - Implement minimal code (users.service.ts)
export class UserService {
  async create(data: CreateUserDto): Promise<User> {
    // Minimal implementation
    return {
      id: '1',
      ...data,
      createdAt: new Date(),
    };
  }
}

// Run test - it should pass
// pnpm run test

// 3. REFACTOR - Improve code quality
export class UserService {
  constructor(private readonly repository: UserRepository) {}

  async create(data: CreateUserDto): Promise<User> {
    return this.repository.save(data);
  }
}

// Run test - should still pass
```

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

The world time system (TICKET-010) provides campaign-specific time tracking with support for custom calendars, time advancement, and integration with the versioning system.

### Overview

- Each campaign can track its own `currentWorldTime` (nullable DateTime field)
- Time can be advanced via GraphQL mutation `advanceWorldTime`
- Supports custom calendar systems defined per World (JSON field)
- Integrates with bitemporal versioning (Version.validFrom/validTo)
- Time advancement triggers cache invalidation (future: rules engine recalculation)

### Key Components

#### WorldTimeService

Located at `packages/api/src/graphql/services/world-time.service.ts`

**Methods:**

- `getCurrentWorldTime(campaignId, user)` - Query current world time for a campaign
- `advanceWorldTime(campaignId, to, userId, expectedVersion, branchId?, invalidateCache?)` - Advance campaign time

**Features:**

- Transaction-safe updates with audit logging
- Optimistic locking for concurrency control (version checking)
- Campaign access authorization via `verifyCampaignAccess` helper
- Configurable cache invalidation
- Validates time only moves forward (no time travel to past)

#### WorldTimeResolver

Located at `packages/api/src/graphql/resolvers/world-time.resolver.ts`

**GraphQL Operations:**

- `query getCurrentWorldTime(campaignId: ID!)` - Returns current world time or null
- `mutation advanceWorldTime(input: AdvanceWorldTimeInput!)` - Advances time and returns result

**Authorization:**

- Query: JwtAuthGuard (authorization delegated to service)
- Mutation: JwtAuthGuard + RolesGuard (requires 'owner' or 'gm' role)

#### Calendar Utilities

Located at `packages/api/src/graphql/utils/calendar.utils.ts`

**Functions:**

- `parseWorldDate(dateString, calendar?)` - Parse date string using custom calendar or ISO format
- `formatWorldDate(date, calendar?, includeTime?)` - Format Date using custom calendar or ISO format
- `validateWorldDate(date, calendar?)` - Validate Date against calendar constraints

**Calendar Definition:**

```typescript
interface CalendarDefinition {
  id: string; // e.g., "absalom-reckoning"
  name: string; // e.g., "Absalom Reckoning"
  monthsPerYear: number; // e.g., 12
  daysPerMonth: number[]; // e.g., [31, 28, 31, ...]
  monthNames: string[]; // e.g., ["Abadius", "Calistril", ...]
  epoch: string; // ISO date, e.g., "2700-01-01T00:00:00Z"
  notes?: string;
}
```

**Supported Date Formats:**

- ISO 8601: `"4707-03-15T12:00:00Z"` or `"4707-03-15"`
- Custom Calendar: `"15 Pharast 4707"` or `"15 Pharast 4707 12:00:00"`

### GraphQL API Examples

#### Query Current World Time

```graphql
query GetCurrentWorldTime {
  getCurrentWorldTime(campaignId: "cm4qk08y3000008l69xj44fyj")
}
```

Returns: Date in ISO 8601 format or null if not set

#### Advance World Time

```graphql
mutation AdvanceWorldTime {
  advanceWorldTime(
    input: {
      campaignId: "cm4qk08y3000008l69xj44fyj"
      to: "4707-04-01T08:00:00Z"
      branchId: "main" # Optional, defaults to "main"
      invalidateCache: true # Optional, defaults to true
    }
  ) {
    campaignId
    previousWorldTime
    currentWorldTime
    affectedEntities
    message
  }
}
```

### Integration Points

1. **Campaign Model**: `currentWorldTime DateTime?` field added to Campaign
2. **Campaign Service**: Automatically includes currentWorldTime in all campaign queries
3. **Versioning System**: Works alongside Version.validFrom/validTo for bitemporal queries
4. **Cache Invalidation**: Calls `CampaignContextService.invalidateContext()` on time advancement
5. **Rules Engine** (Future - TICKET-020+): TODO marker in WorldTimeService for future integration

### Database Schema

```prisma
model Campaign {
  // ... other fields
  currentWorldTime DateTime? @db.Timestamp(3)
  // ... other fields

  @@index([currentWorldTime])
}
```

### Testing

- **Unit Tests**: WorldTimeService (17 tests), Calendar Utilities (31 tests)
- **Integration Tests**: WorldTimeResolver (8 tests), Campaign Service (3 tests for currentWorldTime)
- **Test Coverage**: All scenarios including null handling, validation, authorization, concurrency

### Implementation Details

- **Migration**: `add_campaign_current_world_time` (Stage 1)
- **Commits**:
  - Stage 1: 3934e7c (Database Schema)
  - Stage 2: 2f5ee47 (GraphQL Types)
  - Stage 3: ece354d (WorldTimeService)
  - Stage 4: 39e0b63 (GraphQL Resolver)
  - Stage 5: 91b3cf0 (Campaign Service Integration)
  - Stage 6: 57e1b71 (Calendar System)
  - Stage 7: 5e7fe2f (Rules Engine Hook)

### Common Use Cases

1. **First-time setup**: Set initial world time for campaign
2. **Session advancement**: Advance time at end of game session
3. **Event triggering**: Use world time to determine if scheduled events should activate
4. **Historical queries**: Query entity state at specific world time using existing `asOf` parameters
5. **Custom calendars**: Parse/format dates using world-specific calendar definitions

### Validation Rules

- Time can only move forward (cannot go backward)
- Must have campaign access (owner or member)
- Mutation requires 'owner' or 'gm' role
- Optimistic locking prevents race conditions (version checking)

### Future Enhancements

- Expose `expectedVersion` in AdvanceWorldTimeInput for client-side optimistic locking
- Rules engine integration for automatic recalculation on time advancement (TICKET-020+)
- Time-based event scheduling integration

## Condition System

The Condition System (TICKET-012) provides dynamic computed fields for entities using JSONLogic expressions. It enables game masters to define rules that compute field values based on entity state, creating dynamic properties like "is_trade_hub" for settlements or "is_operational" for structures.

### Overview

- Bind JSONLogic expressions to entity fields for dynamic computed values
- Support both instance-level (specific entity) and type-level (all entities of type) conditions
- Priority-based evaluation when multiple conditions apply to same field
- Full evaluation trace for debugging condition logic
- Integration with Settlement and Structure entities (extensible to other entities)
- Expression validation to prevent malicious or deeply nested expressions

### Key Components

#### FieldCondition Model

Database model defined in `packages/api/prisma/schema.prisma`

**Fields:**

- `id` - Unique identifier (CUID)
- `entityType` - Entity type this condition applies to (Settlement, Structure, Kingdom, Party, Character)
- `entityId` - Specific entity instance ID (null for type-level conditions)
- `field` - Field name this condition computes
- `expression` - JSONLogic expression (JSONB)
- `description` - Human-readable explanation (optional)
- `isActive` - Enable/disable condition without deletion
- `priority` - Evaluation order when multiple conditions apply (higher = higher priority)
- `version` - Optimistic locking version number
- `deletedAt` - Soft delete timestamp
- Audit fields: `createdBy`, `updatedBy`, `createdAt`, `updatedAt`

**Indexes:**

- Composite: (entityType, entityId, field) for instance-level lookups
- Composite: (entityType, field) for type-level lookups
- Individual: isActive, deletedAt, createdBy, updatedBy

#### ConditionEvaluationService

Located at `packages/api/src/graphql/services/condition-evaluation.service.ts`

**Methods:**

- `evaluateExpression<T>(expression, context)` - Core evaluation using JSONLogic parser. Returns success status, value, and optional error.
- `evaluateWithTrace(expression, context)` - Enhanced evaluation with detailed trace for debugging. Captures validation, context building, evaluation steps, and variable resolution.
- `buildContext(entity)` - Formats entity data into evaluation context for JSONLogic variable access. Handles nested objects.
- `validateExpression(expression)` - Validates expression structure before evaluation. Checks for null/undefined, validates object structure, enforces maximum depth limit (10 levels).

**Security Features:**

- Expression depth validation (max 10 levels) prevents infinite recursion attacks
- Safe evaluation via JSONLogic library (no eval or code execution)
- Context validation ensures only valid objects are processed
- Logger excludes sensitive context values (logs keys only)

**Testing:**

- 38 passing unit tests covering all scenarios
- Coverage includes simple/complex expressions, null handling, validation, error handling, trace generation

#### ConditionService

Located at `packages/api/src/graphql/services/condition.service.ts`

**Methods:**

- `create(input, user)` - Creates conditions with expression validation and entity access verification
- `findById(id, user)` - Fetches condition with silent access control (prevents information disclosure)
- `findMany(where, orderBy, skip, take, user?)` - Paginated queries with filtering and sorting
- `findForEntity(entityType, entityId, field, user)` - Retrieves conditions for specific entities/fields ordered by priority
- `update(id, input, user)` - Updates with optimistic locking (version checking) and expression validation
- `delete(id, user)` - Soft deletes by setting deletedAt timestamp
- `toggleActive(id, isActive, user)` - Quick enable/disable without full update
- `evaluateCondition(id, context, user)` - Evaluates condition with provided context and returns full trace

**Authorization System:**

- Campaign-based access control via entity relationship traversal
- Supports 5 entity types: Settlement, Structure, Kingdom, Party, Character
- Type-level conditions (entityId=null) accessible to all authenticated users
- Instance-level conditions require campaign membership verification
- Silent failures in findById prevent information leakage
- Case-insensitive entity type handling prevents bypass attacks

**Security Features:**

- Expression validation before storage prevents recursion attacks
- Parameterized queries via Prisma ORM prevent SQL injection
- Optimistic locking with version field prevents race conditions
- Audit logging for all mutations
- Soft delete pattern prevents accidental data loss

**Testing:**

- 45 passing unit tests covering all CRUD operations
- Coverage includes authorization for all entity types, expression validation, optimistic locking, pagination, filtering, sorting

#### FieldConditionResolver

Located at `packages/api/src/graphql/resolvers/field-condition.resolver.ts`

**Query Resolvers:**

- `getFieldCondition(id)` - Fetch single condition by ID with authorization
- `listFieldConditions(where, orderBy, skip, take)` - Paginated list with filtering and sorting
- `getConditionsForEntity(entityType, entityId, field?)` - Get all conditions for specific entity/field
- `evaluateFieldCondition(input)` - Evaluate condition with custom context, returns full trace

**Mutation Resolvers (owner/gm roles only):**

- `createFieldCondition(input)` - Create instance-level or type-level conditions
- `updateFieldCondition(id, input)` - Update with optimistic locking via expectedVersion
- `deleteFieldCondition(id)` - Soft delete via deletedAt timestamp
- `toggleFieldConditionActive(id, isActive)` - Quick enable/disable

**Authorization:**

- All operations require JwtAuthGuard (authenticated users only)
- All mutations require RolesGuard with 'owner' or 'gm' role
- Entity-level access verification delegated to ConditionService

**Testing:**

- 28 passing integration tests covering all resolvers
- Tests verify proper delegation to service layer
- Edge cases covered: null handling, empty results, authorization paths

#### Entity Computed Fields Integration

**SettlementService** and **StructureService** (packages/api/src/graphql/services/)

**Methods:**

- `getComputedFields(entity, user)` - Fetches active conditions for the entity, builds evaluation context, evaluates each condition, returns map of field names to computed values

**Features:**

- Priority-based evaluation: Higher priority wins when multiple conditions apply to same field
- Graceful error handling: Returns empty object on failure, logs errors with NestJS Logger
- Type-safe implementation with proper Prisma types
- Authorization: Assumes caller has already verified campaign access

**Resolver Integration:**

- `SettlementResolver.computedFields` - Field resolver that calls service method
- `StructureResolver.computedFields` - Field resolver for structures

**Known Limitations:**

1. **N+1 Query Problem**: Current implementation queries conditions individually for each entity. Should be optimized with DataLoader pattern.
2. **Sequential Evaluation**: Conditions evaluated sequentially. Could be parallelized with Promise.all.
3. **No Type-Level Conditions**: Only supports instance-level conditions. Does not query type-level conditions (entityId: null).

### GraphQL API Examples

#### Create Instance-Level Condition

```graphql
mutation CreateSettlementCondition {
  createFieldCondition(
    input: {
      entityType: "Settlement"
      entityId: "settlement-123"
      field: "is_trade_hub"
      expression: {
        and: [
          { ">=": [{ var: "population" }, 5000] }
          { ">=": [{ var: "merchant_count" }, 10] }
          { in: ["trade_route", { var: "tags" }] }
        ]
      }
      description: "Settlement qualifies as trade hub with sufficient population, merchants, and trade route access"
      priority: 100
    }
  ) {
    id
    entityType
    entityId
    field
    expression
    isActive
    priority
    createdAt
  }
}
```

#### Create Type-Level Condition

```graphql
mutation CreateStructureTypeCondition {
  createFieldCondition(
    input: {
      entityType: "Structure"
      entityId: null  # Applies to all structures
      field: "requires_maintenance"
      expression: {
        ">": [{ var: "age_in_years" }, 10]
      }
      description: "All structures older than 10 years require maintenance"
      priority: 50
    }
  ) {
    id
    entityType
    field
    expression
  }
}
```

#### List Conditions for Entity

```graphql
query GetSettlementConditions {
  getConditionsForEntity(
    entityType: "Settlement"
    entityId: "settlement-123"
    field: "is_trade_hub" # Optional - omit to get all fields
  ) {
    id
    field
    expression
    priority
    isActive
  }
}
```

#### Query with Pagination and Filtering

```graphql
query ListActiveConditions {
  listFieldConditions(
    where: { entityType: "Settlement", isActive: true }
    orderBy: { field: PRIORITY, order: DESC }
    skip: 0
    take: 10
  ) {
    id
    entityType
    entityId
    field
    priority
    description
  }
}
```

#### Evaluate Condition with Custom Context

```graphql
mutation TestCondition {
  evaluateFieldCondition(
    input: {
      id: "condition-123"
      context: { population: 6000, merchant_count: 15, tags: ["trade_route", "coastal"] }
    }
  ) {
    success
    value
    error
    trace {
      step
      description
      input
      output
      passed
    }
  }
}
```

#### Query Computed Fields on Settlement

```graphql
query GetSettlement {
  getSettlement(id: "settlement-123") {
    id
    name
    population
    computedFields # Returns JSON object with evaluated conditions
  }
}
```

Example `computedFields` response:

```json
{
  "is_trade_hub": true,
  "danger_level": "medium",
  "prosperity_rating": 85
}
```

#### Update Condition

```graphql
mutation UpdateCondition {
  updateFieldCondition(
    id: "condition-123"
    input: {
      expression: {
        ">=": [{ var: "population" }, 10000]
      }
      description: "Updated threshold for trade hub status"
      expectedVersion: 1  # Optimistic locking
    }
  ) {
    id
    expression
    version
  }
}
```

#### Toggle Condition Active Status

```graphql
mutation DisableCondition {
  toggleFieldConditionActive(id: "condition-123", isActive: false) {
    id
    isActive
  }
}
```

### Context Building

When evaluating conditions, the ConditionEvaluationService builds a context object from entity data that variables in JSONLogic expressions can reference.

**Settlement Context Example:**

```javascript
{
  "id": "settlement-123",
  "name": "Rivertown",
  "population": 6000,
  "merchant_count": 15,
  "tags": ["trade_route", "coastal"],
  "kingdom": {
    "id": "kingdom-456",
    "name": "Northern Realm"
  }
}
```

**JSONLogic Expression:**

```json
{
  "and": [{ ">=": [{ "var": "population" }, 5000] }, { "in": ["trade_route", { "var": "tags" }] }]
}
```

**Variable Resolution:**

- `{ "var": "population" }` → `6000`
- `{ "var": "tags" }` → `["trade_route", "coastal"]`
- `{ "var": "kingdom.name" }` → `"Northern Realm"` (nested access)

### Evaluation Trace

The evaluation trace provides step-by-step debugging information:

```json
{
  "success": true,
  "value": true,
  "trace": [
    {
      "step": 1,
      "description": "Validation",
      "input": { "and": [...] },
      "output": { "valid": true },
      "passed": true
    },
    {
      "step": 2,
      "description": "Context Building",
      "input": { "population": 6000, "tags": [...] },
      "output": { "variableCount": 2 },
      "passed": true
    },
    {
      "step": 3,
      "description": "Expression Evaluation",
      "input": { "and": [...] },
      "output": true,
      "passed": true
    },
    {
      "step": 4,
      "description": "Variable Resolution",
      "input": null,
      "output": {
        "population": 6000,
        "tags": ["trade_route", "coastal"]
      },
      "passed": true
    }
  ]
}
```

### Common Use Cases

1. **Dynamic Availability**: Determine if a structure is operational based on integrity, staffing, and construction status
2. **Conditional Visibility**: Show/hide entities based on discovery conditions or player permissions
3. **Computed Properties**: Calculate derived values like "prosperity_rating" from multiple entity attributes
4. **Event Triggers**: Define conditions for when events should become available or execute
5. **Validation Rules**: Enforce business logic like "settlements need 100 population to build a market"
6. **Status Indicators**: Compute status badges like "endangered", "thriving", "abandoned" based on entity state

### Integration Points

1. **JSONLogic Parser** (TICKET-011): ConditionEvaluationService depends on ExpressionParserService for expression evaluation
2. **Settlement/Structure Services**: Integrated computed field resolution via `getComputedFields()` method
3. **Versioning System**: Uses Version model for audit trail of condition changes
4. **Audit System**: All condition mutations logged via AuditService
5. **Authorization System**: Campaign-based access control via entity relationship traversal

### Validation Rules

- Expression must be valid JSONLogic object (not null, not primitive)
- Maximum depth of 10 levels to prevent recursion attacks
- Entity must exist and user must have access via campaign membership
- Mutations require 'owner' or 'gm' role
- Type-level conditions (entityId=null) accessible to all authenticated users
- Instance-level conditions require campaign access verification

### Performance Considerations

**Current Limitations:**

1. **N+1 Query Pattern**: When querying multiple entities with computed fields, conditions are fetched individually for each entity. Future optimization: Implement DataLoader pattern for batch loading.

2. **Sequential Evaluation**: Conditions are evaluated sequentially in a loop. Future optimization: Parallelize with Promise.all for better performance.

3. **No Type-Level Condition Support**: Currently only queries instance-level conditions (entityId specific). Future enhancement: Query and merge type-level conditions (entityId=null) that apply to all entities of that type.

**Acceptable Trade-offs:**

- Minor N+1 query issue acceptable for typical use cases with small result sets
- Can be optimized with batch access verification if profiling shows issues
- Current implementation prioritizes simplicity and correctness over premature optimization

### Future Enhancements

- Implement DataLoader pattern for batch condition loading (resolves N+1 query problem)
- Parallelize condition evaluation with Promise.all
- Support type-level conditions (entityId: null) in computed field resolution
- Condition versioning with time-travel queries (query conditions as they existed at specific world time)
- Condition templates for common patterns (e.g., "requires minimum population", "has sufficient resources")
- Visual condition builder UI for non-technical game masters
- Condition impact analysis (show which entities would be affected by a condition change)

### Testing

**Unit Tests:**

- ConditionEvaluationService: 38 tests covering evaluation, tracing, validation, context building
- ConditionService: 45 tests covering all CRUD operations, authorization, pagination, validation

**Integration Tests:**

- FieldConditionResolver: 28 tests covering all GraphQL operations
- Settlement/Structure computed fields: Type-check and lint passing (integration tests deferred due to circular dependency issues in test infrastructure)

**Test Coverage:**

- All error paths tested
- Authorization verification for all entity types
- Optimistic locking scenarios
- Expression validation (valid/invalid expressions)
- Soft delete and active status toggling
- Pagination, filtering, sorting with all sort fields

### Implementation Details

**Migration:** `add_field_condition_model` (Stage 1)

**Commits:**

- Stage 1: 4377bae (Database Schema and Prisma Model)
- Stage 2: 765af11 (GraphQL Type Definitions)
- Stage 3: ac69733 (Condition Evaluation Service)
- Stage 4: a8c8961 (Condition Service CRUD Operations)
- Stage 5: 649e679 (GraphQL Resolver)
- Stage 6: 039ddd6 (Entity Computed Fields Integration)

**Files:**

- Model: `packages/api/prisma/schema.prisma` (FieldCondition model)
- Types: `packages/api/src/graphql/types/` (GraphQL type definitions)
- Services: `packages/api/src/graphql/services/condition-evaluation.service.ts`, `condition.service.ts`
- Resolver: `packages/api/src/graphql/resolvers/field-condition.resolver.ts`
- Tests: Colocated `.test.ts` files for all services and resolvers

### Running Migrations

```bash
# Development: Create and apply migration
pnpm --filter @campaign/api exec prisma migrate dev --name description

# Production: Apply pending migrations
pnpm --filter @campaign/api exec prisma migrate deploy

# Check migration status
pnpm --filter @campaign/api exec prisma migrate status

# Reset database (dev only - destructive!)
pnpm --filter @campaign/api exec prisma migrate reset
```

### Creating Migrations

```bash
# 1. Update schema.prisma file
# 2. Generate migration
pnpm --filter @campaign/api exec prisma migrate dev --name descriptive_name

# Create migration without applying (for review)
pnpm --filter @campaign/api exec prisma migrate dev --create-only

# Always commit both schema.prisma and migration files
```

### Common Migration Issues

**If you encounter any migration errors, delegate to the Prisma Database Debugger subagent immediately.**

Common scenarios:

- Migration conflicts
- Schema validation errors
- Database connection issues
- Failed migrations that need resolution
- Type generation issues after migration

---

## Dependency Graph System

The Dependency Graph System (TICKET-014) tracks relationships between conditions, variables, effects, and entities to enable dependency analysis, cycle detection, and efficient cache invalidation for the rules engine.

### Overview

- Builds in-memory dependency graphs per campaign/branch
- Extracts dependencies from JSONLogic expressions (reads) and effects (writes)
- Detects cycles in dependency relationships
- Provides topological sort for evaluation order
- Automatic cache invalidation when conditions or variables change
- Supports incremental updates and invalidation propagation

### Key Components

#### DependencyNode & DependencyEdge

Core types defined in `packages/api/src/graphql/utils/dependency-graph.ts`

**Node Types:**

- `VARIABLE` - State variables
- `CONDITION` - Field conditions
- `EFFECT` - Effects (future)
- `ENTITY` - Entities (future)

**Edge Types:**

- `READS` - Condition/effect reads from variable
- `WRITES` - Effect writes to variable
- `DEPENDS_ON` - Generic dependency

#### DependencyExtractor

Located at `packages/api/src/graphql/utils/dependency-extractor.ts`

**Methods:**

- `extractReads(expression)` - Extracts all `{"var": "..."}` references from JSONLogic expressions
- `extractWrites(effect)` - Extracts target variables from effects (placeholder for TICKET-016)

**Features:**

- Recursive traversal of nested JSONLogic expressions
- Handles complex operators (`and`, `or`, `if`, `map`, `filter`, etc.)
- Deduplicates variable names
- Returns Set of variable names

**Testing:**

- 28 passing unit tests covering all JSONLogic patterns

#### DependencyGraph

In-memory graph data structure at `packages/api/src/graphql/utils/dependency-graph.ts`

**Methods:**

- `addNode(node)` / `removeNode(nodeId)` - Manage nodes
- `addEdge(edge)` / `removeEdge(fromId, toId)` - Manage edges
- `getOutgoingEdges(nodeId)` / `getIncomingEdges(nodeId)` - Query relationships
- `detectCycles()` - DFS-based cycle detection with full paths
- `topologicalSort()` - Kahn's algorithm for evaluation order
- `wouldCreateCycle(fromId, toId)` - Validate edge addition
- `hasPath(sourceId, targetId)` - Path finding

**Features:**

- Adjacency list storage for O(1) node lookups
- DFS coloring algorithm (white/gray/black) for cycle detection
- Kahn's algorithm for stable topological ordering
- Returns detailed cycle paths when detected

**Testing:**

- 49 passing unit tests covering all graph operations

#### DependencyGraphBuilderService

Located at `packages/api/src/graphql/services/dependency-graph-builder.service.ts`

**Methods:**

- `buildGraphForCampaign(campaignId, branchId)` - Build complete graph from database state

**Process:**

1. Query all active FieldConditions for campaign
2. Query all StateVariables for campaign/branch
3. Extract reads from condition expressions
4. Create nodes for variables and conditions
5. Create edges for all dependencies
6. Return populated DependencyGraph

**Testing:**

- 18 passing unit tests with mocked Prisma

#### DependencyGraphService

Located at `packages/api/src/graphql/services/dependency-graph.service.ts`

**Methods:**

- `getGraph(campaignId, branchId, user)` - Get cached or build new graph
- `invalidateGraph(campaignId, branchId)` - Clear cache for rebuild
- `getDependenciesOf(campaignId, branchId, nodeId, user)` - Get upstream dependencies
- `getDependents(campaignId, branchId, nodeId, user)` - Get downstream dependents
- `validateNoCycles(campaignId, branchId, user)` - Check for cycles
- `getEvaluationOrder(campaignId, branchId, user)` - Get topological order

**Caching:**

- In-memory Map keyed by `${campaignId}:${branchId}`
- Cache invalidation on condition/variable changes
- Automatic rebuild on next access

**Authorization:**

- Campaign access verification via `verifyCampaignAccess`
- All operations require campaign membership

**Testing:**

- 28 passing unit tests with mocked dependencies

#### DependencyGraphResolver

Located at `packages/api/src/graphql/resolvers/dependency-graph.resolver.ts`

**Query Resolvers:**

- `getDependencyGraph(campaignId, branchId)` - Get complete graph with stats
- `getNodeDependencies(campaignId, branchId, nodeId)` - Get what node depends on
- `getNodeDependents(campaignId, branchId, nodeId)` - Get what depends on node
- `validateDependencyGraph(campaignId, branchId)` - Check for cycles
- `getEvaluationOrder(campaignId, branchId)` - Get topological sort order

**Mutation Resolvers (owner/gm only):**

- `invalidateDependencyGraph(campaignId, branchId)` - Force cache rebuild

**Authorization:**

- All operations require JwtAuthGuard
- Mutation requires RolesGuard (owner/gm)
- Campaign access verified via service layer

**Testing:**

- 19 passing integration tests

### Cache Invalidation Integration

**Automatic Invalidation:**

The system automatically invalidates dependency graph cache when conditions or variables change:

**ConditionService** (`packages/api/src/graphql/services/condition.service.ts`):

- `create()` - Invalidates after creating instance-level condition
- `update()` - Invalidates after updating condition
- `delete()` - Invalidates after soft-deleting condition
- Type-level conditions (entityId=null) do NOT trigger invalidation

**StateVariableService** (`packages/api/src/graphql/services/state-variable.service.ts`):

- `create()` - Invalidates after creating campaign-scoped variable
- `update()` - Invalidates after updating variable
- `delete()` - Invalidates after soft-deleting variable
- World-scoped variables do NOT trigger invalidation

**Campaign ID Resolution:**

Both services include helper methods to extract campaignId from entities:

- `ConditionService.getCampaignIdForCondition()` - Traverses entity relationships
- `StateVariableService.getCampaignIdForScope()` - Already existed for versioning

**Error Handling:**

- Graceful failure if campaignId cannot be determined
- Try-catch blocks prevent invalidation errors from breaking mutations
- Logging via NestJS Logger for debugging

**Testing:**

- 10 passing integration tests in `dependency-graph-cache-invalidation.integration.test.ts`

### GraphQL API Examples

#### Get Dependency Graph

```graphql
query GetDependencyGraph {
  getDependencyGraph(
    campaignId: "campaign-123"
    branchId: "main" # Optional, defaults to "main"
  ) {
    nodes {
      id
      type
      entityId
      metadata
    }
    edges {
      from
      to
      type
      metadata
    }
    statistics {
      nodeCount
      edgeCount
      variableCount
      conditionCount
    }
  }
}
```

#### Get Node Dependencies

```graphql
query GetNodeDependencies {
  getNodeDependencies(
    campaignId: "campaign-123"
    branchId: "main"
    nodeId: "condition:condition-123"
  ) {
    id
    type
    entityId
  }
}
```

Returns all nodes that this node depends on (upstream dependencies).

#### Get Node Dependents

```graphql
query GetNodeDependents {
  getNodeDependents(
    campaignId: "campaign-123"
    branchId: "main"
    nodeId: "variable:gold_production"
  ) {
    id
    type
    entityId
  }
}
```

Returns all nodes that depend on this node (downstream dependents).

#### Validate Graph for Cycles

```graphql
query ValidateDependencyGraph {
  validateDependencyGraph(campaignId: "campaign-123", branchId: "main") {
    hasCycle
    cycles
    message
  }
}
```

Returns cycle detection results with full paths if cycles exist.

#### Get Evaluation Order

```graphql
query GetEvaluationOrder {
  getEvaluationOrder(campaignId: "campaign-123", branchId: "main")
}
```

Returns array of node IDs in topological order for safe evaluation.

#### Invalidate Cache

```graphql
mutation InvalidateDependencyGraph {
  invalidateDependencyGraph(campaignId: "campaign-123", branchId: "main")
}
```

Manually forces cache rebuild. Requires owner/gm role.

### Integration Points

1. **JSONLogic Parser** (TICKET-011): DependencyExtractor uses ExpressionParserService
2. **Condition System** (TICKET-012): Automatic cache invalidation on create/update/delete
3. **State Variable System** (TICKET-013): Automatic cache invalidation on create/update/delete
4. **Rules Engine** (TICKET-020+): Future integration for incremental recomputation
5. **Effect System** (TICKET-016): Future integration for write dependency tracking

### Performance Characteristics

**Time Complexity:**

- Graph build: O(C + V) where C=conditions, V=variables
- Cycle detection: O(N + E) where N=nodes, E=edges
- Topological sort: O(N + E)
- Cache lookup: O(1)

**Space Complexity:**

- In-memory cache: O(G × (N + E)) where G=campaigns
- Adjacency lists: O(N + E) per graph

**Caching Strategy:**

- Build once, cache until invalidated
- Separate caches per campaign/branch
- Invalidation on relevant mutations only

### Common Use Cases

1. **Cycle Detection**: Validate condition/variable configurations don't create circular dependencies
2. **Evaluation Order**: Determine safe order to evaluate conditions and variables
3. **Impact Analysis**: Find all conditions affected by changing a variable
4. **Dependency Visualization**: Show relationships between rules and data
5. **Incremental Recomputation**: Identify minimal set of nodes to recalculate (future)

### Known Limitations

1. **In-Memory Only**: Cache lost on server restart (acceptable for MVP)
2. **No Persistence**: Graphs rebuilt from database on demand
3. **No Type-Level Conditions**: Currently only tracks instance-level conditions
4. **No Effect Integration**: Effect writes not yet tracked (awaiting TICKET-016)
5. **No Cross-Campaign Dependencies**: Each campaign's graph is isolated

### Validation Rules

- Mutations require 'owner' or 'gm' role
- All operations require campaign membership
- Cycle detection runs before returning evaluation order
- Graph rebuilds automatically when cache miss occurs

### Future Enhancements

- Persistent graph storage (Redis/database)
- Graph visualization endpoints
- Real-time subscriptions for graph changes
- Cross-campaign dependency tracking
- Automatic graph repair (remove problematic edges)
- Graph diff and history tracking
- Performance metrics and profiling

### Testing

**Unit Tests:**

- DependencyExtractor: 28 tests covering JSONLogic patterns
- DependencyGraph: 49 tests covering all operations, cycles, topological sort
- DependencyGraphBuilderService: 18 tests with mocked Prisma
- DependencyGraphService: 28 tests with mocked dependencies

**Integration Tests:**

- DependencyGraphResolver: 19 tests covering all GraphQL operations
- Cache Invalidation: 10 tests verifying automatic invalidation on mutations

**Test Coverage:**

- All error paths tested
- Authorization scenarios verified
- Cycle detection with various patterns
- Topological sort correctness
- Cache invalidation triggers

### Implementation Details

**Commits:**

- Stages 1-5: 82b5bf1 (Core data structures, extraction, and graph algorithms)
- Stage 6: d76ecf7 (Dependency Graph Builder Service)
- Stage 7: 1ad5696 (Dependency Graph Service with caching)
- Stage 8: 7ad6abb (GraphQL Resolver)
- Stage 9: TBD (Integration with Condition/Variable Services)

**Files:**

- Core: `packages/api/src/graphql/utils/dependency-graph.ts`, `dependency-extractor.ts`
- Services: `packages/api/src/graphql/services/dependency-graph-builder.service.ts`, `dependency-graph.service.ts`
- Resolver: `packages/api/src/graphql/resolvers/dependency-graph.resolver.ts`
- Types: `packages/api/src/graphql/types/dependency-graph.type.ts`
- Tests: Colocated `.test.ts` and `.integration.test.ts` files

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
