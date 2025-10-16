# Campaign Management Tool - Claude AI Development Guide

This file contains instructions and guidelines for Claude AI agents working on this project. This is separate from the README.md, which is user-facing documentation.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Repository Structure](#repository-structure)
3. [Development Commands](#development-commands)
4. [Testing Strategy](#testing-strategy)
5. [Code Quality](#code-quality)
6. [TypeScript Guidelines](#typescript-guidelines)
7. [Test-Driven Development (TDD)](#test-driven-development-tdd)
8. [Working with the Monorepo](#working-with-the-monorepo)
9. [Subagent Usage](#subagent-usage)
10. [Common Workflows](#common-workflows)
11. [Debugging](#debugging)
12. [Database Migrations](#database-migrations)

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

### Working Directory Commands

From within a package directory (e.g., `packages/api/`):

```bash
pnpm run dev        # Start development server
pnpm run build      # Build the package
pnpm run test       # Run tests
pnpm run test:watch # Run tests in watch mode
pnpm run lint       # Lint the package
pnpm run type-check # Type-check the package
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

**IMPORTANT**: The base agent should NEVER run tests directly. Use the TypeScript Tester subagent to run tests in watch mode and implement the TDD cycle.

```bash
# Commands below are for reference only - use TypeScript Tester subagent

# Start test watch mode in the package you're working on
cd packages/api
pnpm run test:watch

# Or from root
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

**Purpose**: Run, debug, and fix TypeScript tests; ensure code is fixed to match tests, not vice versa

**When to use**: ALWAYS use this subagent for:

- Running any tests (unit, integration, e2e)
- Debugging test failures
- Understanding why tests are failing
- Fixing code to make tests pass
- Writing new tests (TDD)
- Verifying test coverage
- Any test-related activity

**CRITICAL RULES**:

1. The base agent should NEVER run or debug tests directly
2. The base agent should NEVER attempt to fix failing tests
3. Always delegate all test-related work to this subagent
4. The subagent fixes CODE to match tests, not tests to match broken code

**How to invoke**:

```
Use the Task tool with the typescript-tester subagent:
- description: "Run and debug tests for [package/feature]"
- prompt: "Please run tests for [package]. If any tests fail, analyze the failures
  and fix the implementation code (not the tests) to make them pass while preserving
  the intended functionality."
- subagent_type: "typescript-tester"
```

**Example for test failures**:

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

### Creating New Subagents

If you need a specialized subagent for a recurring task:

1. Create a markdown file in `.claude/agents/`
2. Define the purpose, capabilities, and usage
3. Update this CLAUDE.md file to document it

## Common Workflows

### Starting a New Ticket

1. Read the ticket from `plan/TICKET-XXX.md`
2. Create an implementation plan using TodoWrite
3. If TDD is appropriate, delegate test writing to TypeScript Tester subagent
4. Implement the feature incrementally
5. Delegate quality checks to subagents:
   - Use TypeScript Fixer for type-check and lint
   - Use TypeScript Tester for running tests
6. If errors occur:
   - TypeScript/ESLint errors → TypeScript Fixer subagent
   - Test failures → TypeScript Tester subagent
7. Commit changes with conventional commit format
8. Update the ticket file with implementation notes and commit hash
9. Update `plan/EPIC.md` to mark ticket as complete

### Adding a New Feature (TDD Approach)

1. **Write the test first** (Red) - Delegate to TypeScript Tester subagent
   ```
   Use TypeScript Tester subagent to:
   - Start test watch mode for the package
   - Write a failing test that describes expected behavior
   ```
2. **Implement minimal code** (Green) - Base agent implements
   ```
   - Write minimal implementation code to make test pass
   - Delegate test running to TypeScript Tester subagent
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
5. **Commit**
   ```bash
   git add .
   git commit -m "feat(api): add user creation feature"
   ```

### Fixing a Bug

1. **Write a failing test that reproduces the bug** - Delegate to TypeScript Tester
   ```
   Use TypeScript Tester subagent to:
   - Start test watch mode
   - Write a test that reproduces the bug (should fail)
   ```
2. **Fix the bug** - Base agent fixes, TypeScript Tester verifies
   ```
   - Implement bug fix
   - Use TypeScript Tester to verify test now passes
   ```
3. **Verify no regressions** - Delegate to subagents
   ```
   - TypeScript Tester: run all tests
   - TypeScript Fixer: type-check
   ```
4. **Commit**
   ```bash
   git commit -m "fix(api): correct user validation logic"
   ```

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

**Note**: Database setup will be implemented in TICKET-003. This section will be updated then.

### Running Migrations (Future)

```bash
# Will use Prisma for migrations
pnpm --filter @campaign/api migrate:dev
pnpm --filter @campaign/api migrate:deploy
```

### Creating Migrations (Future)

```bash
# Generate migration from schema changes
pnpm --filter @campaign/api migrate:dev --name description
```

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
- **Test failures** → Use TypeScript Tester subagent (NEVER debug directly)
- **Need to run tests** → Use TypeScript Tester subagent (NEVER run directly)
- **Runtime errors** → Debug directly
- **Build failures** → Check dependencies, use TypeScript Fixer if type-related

---

## Important Reminders

1. **ALWAYS use TDD when implementing new features**
2. **NEVER fix TypeScript/ESLint errors directly - use the TypeScript Fixer subagent**
3. **NEVER run or debug tests directly - use the TypeScript Tester subagent**
4. **NEVER attempt to fix test failures yourself - use the TypeScript Tester subagent**
5. **Delegate to specialized subagents**: TypeScript Tester for tests, TypeScript Fixer for types/linting
6. **Keep commits atomic and use conventional commit format**
7. **Update ticket files and EPIC.md when completing work**
8. **Use TodoWrite to track complex tasks**
9. **Read existing code patterns before implementing new features**

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
Is it a test failure or need to run tests?
├─ YES → Use TypeScript Tester subagent
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
Is it a runtime logic error or bug?
├─ YES → Debug directly, then use TypeScript Tester to write test
│
Is it a feature implementation task?
├─ YES → Implement directly, use TypeScript Tester for tests,
│        use TypeScript Fixer for type/lint verification
│
Otherwise → Handle directly or create new specialized subagent
```
