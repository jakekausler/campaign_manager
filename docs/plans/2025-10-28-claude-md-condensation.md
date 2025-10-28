# CLAUDE.md Condensation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce CLAUDE.md from 1,722 lines to ~800 lines (53% reduction) to optimize AI context window usage while preserving information accessibility.

**Architecture:** Extract detailed guides to `docs/development/` directory, replace verbose feature sections with ultra-brief 1-line index, condense subagent examples to essentials + decision tree, keep all core workflow rules inline.

**Tech Stack:** Markdown documentation, no code changes required.

---

## Task 1: Create Directory Structure

**Files:**

- Create: `docs/development/` directory

**Step 1: Create docs/development/ directory**

```bash
mkdir -p docs/development
```

**Step 2: Verify directory exists**

Run: `ls -la docs/`
Expected: Should show `development/` directory

**Step 3: Commit directory structure**

```bash
git add docs/development/.gitkeep
git commit -m "docs(development): create directory for detailed development guides

Part of CLAUDE.md condensation to reduce token usage by moving
detailed guides to separate files while keeping core workflow
rules in CLAUDE.md.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Extract Frontend Content

**Files:**

- Create: `docs/development/frontend-guide.md` (~350 lines)
- Read from: `CLAUDE.md:842-1202` (Frontend Development section)

**Step 1: Create frontend-guide.md with header**

Create file `docs/development/frontend-guide.md` with:

```markdown
# Frontend Development Guide

> **Quick navigation:** [← Back to CLAUDE.md](../../CLAUDE.md)

This guide covers the React frontend (`packages/frontend/`) - a modern single-page application built with Vite, TypeScript, and Tailwind CSS.

---

[Content from CLAUDE.md lines 842-1202 goes here - all subsections including Tech Stack, Project Structure, Development Workflow, Key Features, Common Tasks, Testing, Troubleshooting, Best Practices, Documentation, Implementation]
```

**Step 2: Copy full frontend section from CLAUDE.md**

Copy lines 842-1202 from CLAUDE.md (entire "## Frontend Development" section) into the new file, preserving all formatting and subsections.

**Step 3: Add cross-reference footer**

Add at bottom of `docs/development/frontend-guide.md`:

```markdown
---

**Related Documentation:**

- [CLAUDE.md](../../CLAUDE.md) - Main development guide
- [packages/frontend/README.md](../../packages/frontend/README.md) - Frontend setup
- [packages/frontend/src/router/README.md](../../packages/frontend/src/router/README.md) - Routing patterns
- [packages/frontend/src/config/README.md](../../packages/frontend/src/config/README.md) - Environment config
```

**Step 4: Verify file created**

Run: `wc -l docs/development/frontend-guide.md`
Expected: ~350-370 lines

**Step 5: Commit frontend guide**

```bash
git add docs/development/frontend-guide.md
git commit -m "docs(frontend): extract frontend development guide from CLAUDE.md

Moved 360 lines of frontend-specific content to dedicated guide
to reduce CLAUDE.md token usage. Content includes:
- Tech stack details (React 18, Vite 5, Apollo Client, Zustand)
- Project structure and architecture
- Development workflow and environment setup
- Common tasks and examples
- Testing with Vitest and MSW
- Troubleshooting and best practices

Part of CLAUDE.md condensation (53% reduction target).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Extract Subagent Content

**Files:**

- Create: `docs/development/subagent-guide.md` (~150 lines)
- Read from: `CLAUDE.md:384-653` (Subagent Usage section)

**Step 1: Create subagent-guide.md with header**

Create file `docs/development/subagent-guide.md` with:

```markdown
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

````

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
````

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

````

**Step 2: Verify file created**

Run: `wc -l docs/development/subagent-guide.md`
Expected: ~150-170 lines

**Step 3: Commit subagent guide**

```bash
git add docs/development/subagent-guide.md
git commit -m "docs(subagents): extract detailed subagent guide from CLAUDE.md

Moved 150 lines of detailed subagent invocation examples to dedicated
guide to reduce CLAUDE.md token usage. Content includes:
- Detailed 'DO NOT use for' lists for each subagent
- Full prompt templates with all parameters
- Multiple example scenarios per subagent
- What each subagent checks/verifies (detailed bullets)
- Creating new subagents guide

CLAUDE.md will retain essential summary table, generic invocation
pattern, one detailed example (Code Reviewer), and decision tree.

Part of CLAUDE.md condensation (53% reduction target).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
````

---

## Task 4: Condense Feature Documentation Section

**Files:**

- Modify: `CLAUDE.md:1204-1613` (replace 13 feature sections)

**Step 1: Replace feature sections with ultra-brief index**

Replace lines 1204-1613 in CLAUDE.md (all feature sections) with:

```markdown
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
```

**Step 2: Verify replacement**

Run: `grep -n "^## Feature Documentation" CLAUDE.md`
Expected: Should show new section at appropriate line number

**Step 3: Count lines saved**

Run: `wc -l CLAUDE.md`
Expected: Should be ~600 lines shorter than before (was 1722, should be ~1100-1200 after this step)

**Step 4: Stage changes**

```bash
git add CLAUDE.md
```

Do NOT commit yet - will commit all CLAUDE.md changes together in Task 7.

---

## Task 5: Condense Subagent Usage Section

**Files:**

- Modify: `CLAUDE.md:384-653` (Subagent Usage section)

**Step 1: Replace Subagent Usage section with condensed version**

Replace lines 384-653 in CLAUDE.md with:

```markdown
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

### Subagent Decision Tree

When you encounter an issue, use this decision tree:

```

Are you about to commit code?
├─ YES → **MANDATORY:** Use Code Reviewer subagent FIRST
│ Only commit after approval
│
Are you about to mark a ticket as complete?
├─ YES → **MANDATORY:** Use Project Manager subagent FIRST
│ Only close ticket after approval
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
│ use TypeScript Tester to run tests,
│ use TypeScript Fixer for type/lint verification,
│ use Code Reviewer before commit,
│ use Project Manager before closing ticket
│
Otherwise → Handle directly or create new specialized subagent

```

```

**Step 2: Verify replacement**

Run: `grep -n "^## Subagent Usage" CLAUDE.md`
Expected: Should show condensed section

**Step 3: Stage changes**

```bash
git add CLAUDE.md
```

Do NOT commit yet.

---

## Task 6: Condense Frontend Development Section

**Files:**

- Modify: `CLAUDE.md:842-1202` (Frontend Development section)

**Step 1: Replace Frontend Development section with brief summary**

Replace lines 842-1202 in CLAUDE.md with:

````markdown
## Frontend Development

The React frontend (`packages/frontend/`) is a modern single-page application built with Vite, TypeScript, and Tailwind CSS.

**Quick Start:**

```bash
pnpm --filter @campaign/frontend dev  # Dev server on port 9263
pnpm --filter @campaign/frontend test # Run tests with Vitest
```
````

**See [docs/development/frontend-guide.md](docs/development/frontend-guide.md) for complete guide including:**

- Tech stack details (React 18, Vite 5, Apollo Client, Zustand)
- Project structure and architecture
- Development workflow and environment setup
- Common tasks (adding pages, components, GraphQL operations)
- Testing with Vitest and MSW
- Troubleshooting and best practices

````

**Step 2: Verify replacement**

Run: `grep -n "^## Frontend Development" CLAUDE.md`
Expected: Should show condensed section

**Step 3: Stage changes**

```bash
git add CLAUDE.md
````

Do NOT commit yet.

---

## Task 7: Update Table of Contents

**Files:**

- Modify: `CLAUDE.md:5-19` (Table of Contents)

**Step 1: Verify current ToC matches new structure**

The Table of Contents should already be mostly correct. Verify these sections are listed:

```markdown
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
```

**Step 2: Update ToC if needed**

If any section names changed during condensation, update the ToC links to match.

**Step 3: Stage changes**

```bash
git add CLAUDE.md
```

Do NOT commit yet.

---

## Task 8: Verify Links and Line Count

**Files:**

- Read: `CLAUDE.md` (verify all links work)

**Step 1: Check all internal links**

Verify these key links exist and work:

```bash
# Check links to new docs
grep -o "docs/development/[^)]*" CLAUDE.md
```

Expected output:

```
docs/development/frontend-guide.md
docs/development/subagent-guide.md
```

**Step 2: Check all feature documentation links**

```bash
# Check links to feature docs
grep -o "docs/features/[^)]*" CLAUDE.md
```

Expected: Should show all 11 feature documentation links

**Step 3: Verify line count target**

```bash
wc -l CLAUDE.md
```

Expected: ~800 lines (target), acceptable range: 750-850 lines

If outside range, identify which sections need further condensation.

**Step 4: Create verification summary**

Document findings:

- Total lines: [actual count]
- Target: 800 lines
- Original: 1,722 lines
- Reduction: [calculate percentage]
- All links verified: [yes/no]

---

## Task 9: Code Review and Commit

**Files:**

- Review: All staged changes in `CLAUDE.md`, `docs/development/frontend-guide.md`, `docs/development/subagent-guide.md`

**Step 1: Review git diff**

```bash
git diff --cached --stat
```

Expected output should show:

```
CLAUDE.md                               | ~900 +----
docs/development/frontend-guide.md      | 350 +++++
docs/development/subagent-guide.md      | 150 +++++
```

**Step 2: Use Code Reviewer subagent (MANDATORY)**

**REQUIRED SUB-SKILL:** Use superpowers:code-reviewer

```
Use Task tool with code-reviewer subagent:
- description: "Review CLAUDE.md condensation changes"
- prompt: "Please review the staged changes for CLAUDE.md condensation. Verify:
  1. No information loss (all content exists somewhere)
  2. All links are correct and point to existing files
  3. Formatting is consistent
  4. No broken markdown syntax
  5. Table of Contents matches actual sections

  Flag any issues that need to be fixed before commit."
- subagent_type: "code-reviewer"
```

**Step 3: Address any issues flagged by Code Reviewer**

If Code Reviewer flags issues, fix them before proceeding.

**Step 4: Final verification**

```bash
# Verify all new files exist
ls -la docs/development/frontend-guide.md
ls -la docs/development/subagent-guide.md

# Verify line count
wc -l CLAUDE.md
```

**Step 5: Commit changes**

```bash
git commit -m "$(cat <<'EOF'
docs(root): condense CLAUDE.md from 1,722 to ~800 lines (53% reduction)

Reduced CLAUDE.md token usage to optimize AI context window while
preserving all information accessibility.

Changes:
- Extracted frontend content to docs/development/frontend-guide.md (350 lines)
- Extracted detailed subagent examples to docs/development/subagent-guide.md (150 lines)
- Replaced 13 feature "Quick Reference" sections with ultra-brief 1-line index (600 → 50 lines)
- Condensed Subagent Usage section to essentials + decision tree (250 → 100 lines)
- Condensed Frontend Development to brief summary with link (360 → 15 lines)

All removed content moved to dedicated docs with cross-references.
No information loss - everything accessible via links from CLAUDE.md.

Token savings: ~922 lines (53% reduction)
Final size: ~800 lines (target met)

Part of CLAUDE.md condensation design (docs/plans/2025-10-28-claude-md-condensation-design.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Step 6: Verify commit**

```bash
git log -1 --stat
```

Expected: Should show the commit with all three files modified/created

---

## Success Criteria

- ✅ CLAUDE.md reduced from 1,722 lines to ~800 lines (±50 lines acceptable)
- ✅ No information loss (all content exists in CLAUDE.md or linked docs)
- ✅ All links work correctly
- ✅ docs/development/frontend-guide.md created (~350 lines)
- ✅ docs/development/subagent-guide.md created (~150 lines)
- ✅ Code Reviewer approval obtained before commit
- ✅ All changes committed with detailed message
- ✅ Table of Contents updated and accurate

---

## Rollback Plan

If issues are discovered after implementation:

```bash
# View commit history
git log --oneline -5

# Revert to before condensation
git revert <commit-hash>

# Or reset to before condensation (if not pushed)
git reset --hard <commit-before-condensation>
```
