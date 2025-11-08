# TICKET-035 - Stage 1: Seed Data Enhancement

## Goal

Enhance the existing seed script to create comprehensive demo data showcasing all features, including regions, multiple locations, settlements with structures, events with conditions/effects, encounters with dependencies, and branching timelines.

## Context

The current seed script (`packages/api/prisma/seed.ts`) creates basic entities (users, roles, world, campaign, party, characters, one location). We need to expand it significantly to demonstrate:

- **Geographic Complexity**: Multiple regions with evolving borders, 20+ locations distributed across regions
- **Settlement Hierarchy**: 5-10 settlements with realistic distribution, each with 2-5 structures
- **Settlement/Structure Progression**: Examples at different levels showing typed variables
- **Events & Encounters**: 15+ events and 10+ encounters with meaningful conditions, effects, and dependencies
- **Branching**: Create at least 2-3 alternate timeline branches showing "what-if" scenarios
- **Condition System**: Use JSONLogic expressions that reference settlement/structure state
- **Effect System**: Use JSON Patch operations to mutate world state

**Files to Modify:**

- `packages/api/prisma/seed.ts` - Main seed script

**Patterns to Follow:**

- Use Prisma's `create` and `createMany` methods efficiently
- Organize code into logical sections with clear console.log messages
- Use meaningful, lore-consistent names (continuing Golarion/Pathfinder theme)
- Reference existing feature documentation for condition/effect formats

## Tasks

### Development Tasks

- [ ] Add regions to the world with geographic boundaries (3-5 regions covering different terrain types)
- [ ] Create 20+ locations distributed across regions (cities, dungeons, landmarks, wilderness)
- [ ] Create 5-10 settlements with realistic distribution and typed variable schemas
- [ ] Create 20+ structures across settlements showing different types (temples, barracks, markets, libraries, etc.)
- [ ] Add settlement and structure level progression examples (levels 1-5)
- [ ] Create 15+ events with JSONLogic conditions referencing settlement/structure state
- [ ] Create JSON Patch effects for events that mutate world state
- [ ] Create 10+ encounters with dependency relationships
- [ ] Create 2-3 alternate timeline branches with meaningful divergence points
- [ ] Add console.log summary showing all created entities

### Testing Tasks

- [ ] Test seed script execution with clean database
- [ ] Verify all entities are created successfully
- [ ] Verify relationships are properly established (foreign keys, dependencies)
- [ ] Verify settlement/structure typed variables are correctly formatted
- [ ] Verify JSONLogic conditions are valid
- [ ] Verify JSON Patch effects are valid

### Quality Assurance Tasks

- [ ] Run type-check and lint (use TypeScript Fixer subagent)
- [ ] Fix type/lint errors (if any exist from previous task)

### Review and Commit Tasks

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

_Add notes here as tasks are completed_

## Commit Hash

_Added when final commit task is complete_
