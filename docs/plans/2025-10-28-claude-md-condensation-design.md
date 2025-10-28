# CLAUDE.md Condensation Design

**Date:** 2025-10-28
**Purpose:** Reduce CLAUDE.md token usage from 1,722 lines to ~800 lines while maintaining essential information for AI agents
**Strategy:** Core + Reference approach - keep essential workflow info inline, move detailed guides to separate docs

## Problem Statement

The current CLAUDE.md file is 1,722 lines long, causing AI context window inefficiencies. The file contains:

- Essential workflow rules and commands (keep)
- Detailed subagent examples with full prompts (condense)
- 13 feature sections with full "Quick Reference" blocks (~600 lines, condense heavily)
- Frontend development guide (300+ lines, extract)

**Goal:** Reduce to ~800 lines (53% reduction) while preserving information accessibility.

## Design Decisions

### 1. Overall Strategy: "Core + Reference"

**Keep in CLAUDE.md:**

- Essential commands and rules needed for EVERY task
- Critical workflow decision trees
- Brief summaries with links to detailed docs

**Move to separate docs:**

- Package-specific detailed guides (frontend, backend packages)
- Detailed subagent invocation examples
- Feature implementation details (already mostly done)

### 2. User Requirements (From Brainstorming)

1. **Primary Goal:** AI context window limits (token usage optimization)
2. **Feature Sections:** Ultra-brief (1-line) format replacing Quick Reference blocks
3. **Frontend Section:** Move to docs/development/frontend-guide.md
4. **Subagent Usage:** Keep essential only (~100 lines), move detailed examples to separate doc
5. **Overall Strategy:** Core + Reference (~800 lines target)

## File Structure Changes

### New File Structure

```
CLAUDE.md (~800 lines, down from 1,722)
├── Core sections (unchanged):
│   ├── Project Overview
│   ├── Repository Structure
│   ├── Development Commands
│   ├── Testing Strategy
│   ├── Code Quality
│   ├── Git Commit Messages
│   ├── TypeScript Guidelines
│   ├── TDD Workflow
│   ├── Working with the Monorepo
│   ├── Common Workflows (condensed)
│   ├── Debugging (condensed)
│   ├── Database Migrations
│   ├── Quick Reference Card
│   ├── Important Reminders
│   ├── Getting Help
│   └── Subagent Decision Tree
│
├── Condensed sections:
│   ├── Subagent Usage (~100 lines, down from ~250)
│   └── Feature Documentation (~50 lines, down from ~600)
│
└── Removed sections (moved to separate docs):
    ├── Frontend Development (→ docs/development/frontend-guide.md)
    ├── Detailed subagent examples (→ docs/development/subagent-guide.md)
    └── Feature "Quick Reference" blocks (already in docs/features/)

docs/development/ (new directory)
├── frontend-guide.md (~350 lines from CLAUDE.md Frontend section)
│   ├── Tech Stack
│   ├── Project Structure
│   ├── Development Workflow
│   ├── Key Features
│   ├── Common Tasks
│   ├── Testing
│   ├── Troubleshooting
│   ├── Best Practices
│   ├── Documentation references
│   └── Implementation history
│
└── subagent-guide.md (~150 lines from CLAUDE.md Subagent section)
    ├── Detailed invocation examples for each subagent
    ├── Full "DO NOT use for" lists
    ├── Complete prompt templates
    ├── Multiple example scenarios
    ├── What each subagent checks/verifies
    └── Creating new subagents guide

docs/features/ (existing, no changes)
└── [11 existing feature docs remain unchanged]
```

### Token Savings Breakdown

| Section              | Current Lines | New Lines | Savings        |
| -------------------- | ------------- | --------- | -------------- |
| Subagent Usage       | 250           | 100       | 150            |
| Feature Sections     | 600           | 50        | 550            |
| Frontend Development | 360           | 15        | 345            |
| Common Workflows     | 120           | 100       | 20             |
| **TOTAL**            | **1,722**     | **~800**  | **~922 (53%)** |

## Detailed Section Designs

### A. Subagent Usage Section (~100 lines)

**Keep in CLAUDE.md:**

- Summary table of all subagents (purpose, when to use)
- Generic invocation pattern (one example)
- One detailed example (Code Reviewer as it's MANDATORY)
- Link to detailed guide
- Full decision tree (keep as-is)

**Format:**

```markdown
## Subagent Usage

**CRITICAL RULE**: Never run tests, fix TypeScript/ESLint errors directly.
Always delegate to specialized subagents.

### Available Subagents (Summary)

| Subagent          | Purpose                             | When to Use       |
| ----------------- | ----------------------------------- | ----------------- |
| TypeScript Tester | Run and debug existing tests        | Test failures     |
| TypeScript Fixer  | Fix TS/ESLint errors                | Type/lint errors  |
| Code Reviewer     | **MANDATORY** before commits        | Every commit      |
| Project Manager   | **MANDATORY** before ticket closure | Every ticket      |
| Prisma Debugger   | Prisma/database issues              | Schema/migrations |
| Ticket Navigator  | Find next work                      | `/next_ticket`    |

**Invocation Pattern:**
[Generic example]

**Example - Code Reviewer (MANDATORY):**
[One detailed example]

See [docs/development/subagent-guide.md] for detailed examples.

### Subagent Decision Tree

[Keep entire decision tree - ~30 lines]
```

**Move to docs/development/subagent-guide.md:**

- Full description of each subagent
- Detailed "DO NOT use for" lists
- Complete prompt templates with all parameters
- 2-3 example scenarios per subagent
- What each subagent checks/verifies (detailed bullets)
- Creating new subagents section

### B. Feature Documentation Section (~50 lines)

**Replace all 13 feature sections with ultra-brief index:**

```markdown
## Feature Documentation

Complete feature documentation available in `docs/features/` and `docs/development/`:

- **Frontend Development** - React/Vite/TypeScript setup, architecture, common tasks → [docs/development/frontend-guide.md]
- **Map Editing Tools** - Interactive drawing and editing for map geometries → [docs/features/map-editing-tools.md]
- **Flow View** - Interactive flowchart visualization for dependency graphs → [docs/features/flow-view.md]
- **Timeline View** - Interactive timeline for events and encounters → [docs/features/timeline-view.md]
- **Entity Inspector** - Comprehensive drawer for inspecting/editing entities → [docs/features/entity-inspector.md]
- **Event & Encounter Resolution** - Resolution workflow for completing events and encounters → [docs/features/event-encounter-resolution.md]
- **Cross-View Selection** - Synchronized entity selection across Map/Flow/Timeline → [docs/features/cross-view-selection.md]
- **World Time System** - Campaign-specific time tracking with custom calendars → [docs/features/world-time-system.md]
- **Condition System** - Dynamic computed fields using JSONLogic expressions → [docs/features/condition-system.md]
- **Dependency Graph System** - Tracks relationships for dependency analysis → [docs/features/dependency-graph-system.md]
- **Rules Engine Worker** - High-performance condition evaluation microservice → [docs/features/rules-engine-worker.md]
- **Scheduler Service** - Time-based operations and periodic events microservice → [docs/features/scheduler-service.md]
- **Effect System** - World state mutation via JSON Patch operations → [docs/features/effect-system.md]
```

**Each line format:** `- **Title** - One-sentence description → [link]`

### C. Frontend Development Section (Extract to New File)

**Keep in CLAUDE.md (~15 lines):**

````markdown
## Frontend Development

The React frontend (`packages/frontend/`) is a modern SPA built with Vite, TypeScript, and Tailwind CSS.

**Quick Start:**

```bash
pnpm --filter @campaign/frontend dev  # Dev server on port 9263
pnpm --filter @campaign/frontend test # Run tests with Vitest
```
````

See [docs/development/frontend-guide.md](docs/development/frontend-guide.md) for complete guide including:

- Tech stack details (React 18, Vite 5, Apollo Client, Zustand)
- Project structure and architecture
- Development workflow and environment setup
- Common tasks (adding pages, components, GraphQL operations)
- Testing with Vitest and MSW
- Troubleshooting and best practices

```

**Move to docs/development/frontend-guide.md (~350 lines):**
- All content from current "Frontend Development" section
- Add cross-reference back to CLAUDE.md at top
- Keep all subsections: Tech Stack, Project Structure, Development Workflow, Key Features, Common Tasks, Testing, Troubleshooting, Best Practices, Documentation, Implementation

### D. Common Workflows Section (Minor Condensation)

**Current:** 120 lines with detailed step-by-step workflows

**Condensation Strategy:**
- Keep "Starting a New Ticket" workflow (essential)
- Keep "Adding a New Feature (TDD Approach)" (essential)
- Condense "Fixing a Bug" to reference TDD workflow
- Keep "Adding a New Package" (rare but essential when needed)
- Remove some redundant explanatory text

**Target:** ~100 lines (save 20 lines)

## Implementation Plan

### Phase 1: Create New Documentation Files
1. Create `docs/development/` directory
2. Extract frontend content to `docs/development/frontend-guide.md`
3. Extract subagent details to `docs/development/subagent-guide.md`

### Phase 2: Condense CLAUDE.md
1. Replace Feature sections with ultra-brief index
2. Condense Subagent Usage section
3. Replace Frontend Development with brief summary
4. Minor condensation of Common Workflows

### Phase 3: Validation
1. Verify all links work
2. Verify no information loss (everything exists somewhere)
3. Test with AI agent - does it find information easily?
4. Check line count achieves ~800 target

### Phase 4: Commit Changes
1. Git commit with descriptive message explaining restructuring
2. Update any references to removed sections

## Migration Notes

### For AI Agents
- CLAUDE.md remains the primary entry point
- All essential workflow rules remain in CLAUDE.md
- Detailed guides available via links in CLAUDE.md
- No behavioral changes required

### For Humans
- CLAUDE.md is now more scannable and navigable
- Detailed information still available, better organized
- New `docs/development/` directory for development guides

## Success Criteria

1. ✅ CLAUDE.md reduced from 1,722 lines to ~800 lines (53% reduction)
2. ✅ No information loss (all content exists in some doc)
3. ✅ All essential workflow rules remain in CLAUDE.md
4. ✅ Links to detailed docs work correctly
5. ✅ AI agents can still find critical information quickly
6. ✅ Structure is maintainable going forward

## Appendix: Full New CLAUDE.md Structure

```

# Campaign Management Tool - Claude AI Development Guide

## Table of Contents

[Same as current, update section links]

## Project Overview

[Keep as-is]

## Repository Structure

[Keep as-is]

## Development Commands

[Keep as-is]

## Testing Strategy

[Keep as-is]

## Code Quality

[Keep as-is]

## Git Commit Messages

[Keep as-is]

## TypeScript Guidelines

[Keep as-is]

## Test-Driven Development (TDD)

[Keep as-is]

## Working with the Monorepo

[Keep as-is]

## Subagent Usage

[CONDENSED: ~100 lines, see Section A above]

## Common Workflows

[CONDENSED: ~100 lines, minor edits]

## Debugging

[Keep as-is]

## Database Migrations

[Keep as-is]

## Frontend Development

[CONDENSED: ~15 lines, see Section C above]

## Feature Documentation

[REPLACED: ~50 lines, see Section B above]

## Quick Reference Card

[Keep as-is]

## Important Reminders

[Keep as-is]

## Getting Help

[Keep as-is]

## Subagent Decision Tree

[Keep as-is]

```

Total: ~800 lines (53% reduction from 1,722)
```
