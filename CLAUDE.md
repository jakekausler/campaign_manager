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
