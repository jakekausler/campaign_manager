# Subagent Detailed Guide

> **Quick navigation:** [← Back to CLAUDE.md](../../CLAUDE.md)

This guide provides detailed invocation examples and patterns for each specialized subagent. For a quick summary and decision tree, see [CLAUDE.md Subagent Usage section](../../CLAUDE.md#subagent-usage).

---

## TypeScript Tester

**Full Description:**

Run and debug existing TypeScript tests; ensure code is fixed to match tests, not vice versa.

**When to Use (Detailed):**

- Running existing tests (unit, integration, e2e)
- Debugging test failures
- Understanding why tests are failing
- Fixing implementation code to make existing tests pass

**DO NOT Use For:**

- Writing new tests (base agent should write tests)
- Writing new implementation code (base agent should implement)
- Refactoring existing code (base agent should refactor)
- TDD development (base agent should write tests and code, this agent only runs them)

**Detailed Invocation Examples:**

Example 1 - Running tests after writing them:

```

Use Task tool with typescript-tester subagent:

- description: "Run and debug tests for [package/feature]"
- prompt: "I've written tests for [feature] in [file path]. Please run the tests
  and if any fail, analyze the failures and fix the implementation code (not the
  tests) to make them pass while preserving the intended functionality."
- subagent_type: "typescript-tester"

```

Example 2 - Debugging specific test failures:

```

Use Task tool with typescript-tester subagent:

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

Example 3 - Running full test suite:

```

Use Task tool with typescript-tester subagent:

- description: "Run all tests for api package"
- prompt: "Please run all tests in @campaign/api package and report results.
  If any tests fail, analyze failures and fix implementation code."
- subagent_type: "typescript-tester"

```

---

## TypeScript Fixer

**Full Description:**

Fix TypeScript compilation and ESLint errors with minimal changes.

**When to Use (Detailed):**

- TypeScript compilation errors
- ESLint errors or warnings
- Type mismatches
- Import/export errors
- Module resolution problems

**DO NOT Use For:**

- Logic bugs (debug directly)
- Test failures (use TypeScript Tester)
- Runtime errors (debug directly unless type-related)

**Detailed Invocation Examples:**

Example 1 - Type errors:

```

Use Task tool with typescript-fixer subagent:

- description: "Fix TypeScript errors in [package/file]"
- prompt: "I'm encountering the following TypeScript/ESLint errors in [package]:
  [paste error output]

  Please read the affected files, fix the errors, and verify the fixes by running type-check and lint."

- subagent_type: "typescript-fixer"

```

Example 2 - Import resolution:

```

Use Task tool with typescript-fixer subagent:

- description: "Fix import errors in settlement service"
- prompt: "Getting module resolution errors in packages/api/src/settlements/settlement.service.ts:

  error TS2307: Cannot find module '@campaign/shared' or its corresponding type declarations.

  Please fix the import paths and verify with type-check."

- subagent_type: "typescript-fixer"

```

---

## Code Reviewer (MANDATORY before commits)

**Full Description:**

Review code changes for best practices, security vulnerabilities, performance issues, and complexity overhead. **MANDATORY** before every commit with code changes.

**When to Use (Detailed):**

- Before committing any code changes (MANDATORY)
- After implementing features or bug fixes
- When refactoring code
- Before any git commit (MANDATORY)

**What It Checks:**

- **Security:** Hardcoded secrets, SQL injection, XSS, authentication bypasses, insecure deserialization
- **Performance:** N+1 queries, inefficient algorithms, memory leaks, unnecessary re-renders
- **Code Quality:** SRP violations, DRY violations, naming conventions, cyclomatic complexity
- **Best Practices:** Project conventions, error handling, proper logging, test coverage
- **Maintainability:** Readability, coupling, cohesion, testability

**Detailed Invocation Example:**

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

---

## Project Manager (MANDATORY before ticket closure)

**Full Description:**

Verify implemented code matches ticket requirements and acceptance criteria. **MANDATORY** before marking a ticket as complete.

**When to Use (Detailed):**

- Before marking a ticket as completed (MANDATORY)
- Before updating ticket status to "done"
- After all implementation work is finished
- Before updating EPIC.md

**What It Verifies:**

- All scope of work items are addressed
- All acceptance criteria are met
- Technical requirements are implemented
- Required tests are written and passing
- Documentation is updated as required
- No missing functionality

**Detailed Invocation Example:**

```

Use Task tool with project-manager subagent:

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

---

## Prisma Database Debugger

**Full Description:**

Debug and fix Prisma ORM and database-related issues including schema, migrations, queries, and connections.

**When to Use (Detailed):**

- Prisma Client errors and query issues
- Prisma schema validation errors
- Database migration errors (`prisma migrate` failures)
- Database connection issues
- Schema model relationship problems
- Database constraint violations
- Type generation issues (`prisma generate` failures)
- Prisma introspection errors
- Database sync issues between schema and actual database

**What It Handles:**

- Prisma Schema Language (PSL) issues
- Migration workflow problems
- Database connection and pooling issues
- Relation field configuration
- PostGIS and spatial data with Prisma
- Seeding and introspection issues
- Docker database environment issues

**Detailed Invocation Examples:**

Example 1 - Migration failure:

```

Use Task tool with prisma-debugger subagent:

- description: "Fix Prisma migration error"
- prompt: "Migration failing with error:

  Error: P3009: migrate found failed migrations in the target database

  Please analyze the migration state, fix any issues, and ensure database
  is in sync with schema."

- subagent_type: "prisma-debugger"

```

Example 2 - Schema validation:

```

Use Task tool with prisma-debugger subagent:

- description: "Fix Prisma schema validation errors"
- prompt: "Getting schema validation errors:

  Error: Field 'settlementId' in model 'Structure' is missing an opposite relation field

  Please fix the schema relationships and verify with prisma validate."

- subagent_type: "prisma-debugger"

```

---

## Ticket Navigator

**Full Description:**

Quickly determine the next incomplete ticket and stage from the project plan. Used by `/next_ticket` slash command.

**When to Use (Detailed):**

- Starting work with `/next_ticket` slash command
- Checking which ticket/stage to work on next
- Verifying completion status of tickets
- Need to know current progress in project plan

**Output Format:**

Concise 4-line format:

```

Next Ticket: TICKET-###
Title: [ticket title]
Implementation Plan: [EXISTS | DOES NOT EXIST]
Next Stage: [stage name if plan exists, otherwise N/A]

```

**Detailed Invocation Example:**

```

Use Task tool with general-purpose subagent:

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

---

## Creating New Subagents

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
4. Update CLAUDE.md to document it

**Frontmatter Header Format:**

- `name`: kebab-case name matching the filename (without .md)
- `description`: One sentence describing the subagent's purpose
- Must be enclosed in `---` delimiters

---

**Related Documentation:**

- [CLAUDE.md](../../CLAUDE.md) - Main development guide
- [.claude/agents/](../../.claude/agents/) - Subagent definitions
