# TICKET-006: Entity CRUD Operations - Implementation Plan

## Overview

Implementing complete CRUD operations for all core domain entities with soft delete, archive functionality, cascade delete logic, and comprehensive audit logging.

## Stage 1: Foundation (Completed)

**Goal**: Set up shared infrastructure and patterns
**Success Criteria**:

- [x] archivedAt field added to database schema
- [x] Audit service created for mutation logging
- [x] Shared pagination types and utilities
- [x] Shared filter input types
- [x] Base patterns documented

**Status**: Completed (Commit: 8e00f79)

## Stage 2: Core Services (First Batch) (Completed)

**Goal**: Implement World, Campaign, and Character services with full CRUD
**Success Criteria**:

- [x] WorldService: CRUD + archive + cascade delete (to Campaigns and Locations)
- [x] CampaignService: CRUD + archive + cascade delete (to Events, Encounters, etc.)
- [x] CharacterService: CRUD + archive (no cascade)
- [x] All have audit logging
- [x] Tests written and passing for each service

**Status**: Completed (Commit: 69c4b04)

## Stage 3: Kingdom Management Services (Completed)

**Goal**: Implement Party, Kingdom, Settlement, and Structure services
**Success Criteria**:

- [x] PartyService: CRUD + archive
- [x] KingdomService: CRUD + archive + cascade delete (to Settlements)
- [x] SettlementService: CRUD + archive + cascade delete (to Structures)
- [x] StructureService: CRUD + archive
- [x] Tests written and passing for each service

**Status**: Completed (Commit: 430db93)

## Stage 4: Location and Event Services

**Goal**: Implement Location, Encounter, Event, and Link services
**Success Criteria**:

- [ ] LocationService: CRUD + archive + hierarchical cascade delete
- [ ] EncounterService: CRUD + archive (no cascade per ticket)
- [ ] EventService: CRUD + archive (no cascade per ticket)
- [ ] LinkService: Create and query links between entities
- [ ] Tests written and passing for each service

**Status**: Not Started

## Stage 5: GraphQL Layer

**Goal**: Create GraphQL resolvers, types, and inputs for all entities
**Success Criteria**:

- [ ] GraphQL types for all entities
- [ ] Input DTOs with validation for all entities
- [ ] Resolvers for all CRUD operations
- [ ] Field resolvers for relationships
- [ ] DataLoaders for efficient relationship loading
- [ ] Integration tests for GraphQL layer

**Status**: Not Started

## Stage 6: Final Testing and Documentation

**Goal**: Comprehensive testing and documentation updates
**Success Criteria**:

- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Ticket marked complete with commit hashes

**Status**: Not Started

## Key Architectural Decisions

### Soft Delete Only

- ALL deletes are soft (set `deletedAt`)
- NO hard deletes ever
- Deleted entities excluded from default queries

### Archive vs Delete

- **Archive** (`archivedAt`): Temporary hiding, easily restored
- **Delete** (`deletedAt`): Permanent soft removal with audit trail
- Active entities: both fields are `null`

### Cascade Delete Rules

| Parent Entity | Cascade Behavior                                                       |
| ------------- | ---------------------------------------------------------------------- |
| World         | Cascade to Campaigns, Locations                                        |
| Campaign      | Cascade to Events, Encounters, Characters, Parties, Kingdoms, Branches |
| Kingdom       | Cascade to Settlements                                                 |
| Settlement    | Cascade to Structures                                                  |
| Location      | Cascade to child Locations (hierarchy)                                 |
| Event         | Do not cascade (keep audit trail)                                      |
| Encounter     | Do not cascade (keep audit trail)                                      |

### Authorization Pattern

- Use existing CampaignMembership and permissions system
- OWNER and GM roles can mutate
- PLAYER and VIEWER roles are read-only
- Check permissions at service layer before mutations

### Audit Logging

- Log ALL mutations: CREATE, UPDATE, DELETE, ARCHIVE, RESTORE
- Include user ID, entity type, entity ID, and changes
- Use centralized Audit service

### Pagination

- Use cursor-based pagination for GraphQL
- Return edges with cursors + pageInfo
- Default page size: 20 items

## Current Progress

- Stage 1: ✅ Complete (Commit: 8e00f79)
- Stage 2: ✅ Complete (Commit: 69c4b04)
- Stage 3: ✅ Complete (Commit: 430db93)
- Stage 4: Ready to begin
- Estimated remaining time: 2-3 days

## Commit Log

- **8e00f79**: feat(api): add entity CRUD infrastructure foundation (TICKET-006)
  - Database schema with archivedAt fields
  - Audit service with test coverage
  - Pagination infrastructure
  - Filter infrastructure

- **69c4b04**: feat(api): implement core entity CRUD services (TICKET-006 Stage 2)
  - WorldService: Full CRUD with cascade delete to Campaigns and Locations
  - CampaignService: Full CRUD with complex cascade delete through hierarchy
  - CharacterService: Full CRUD without cascade
  - 53 tests passing (11 World, 20 Campaign, 22 Character)
  - Input validation with class-validator decorators
  - Audit logging for all mutations
  - Authorization checks (owner/GM permissions)

- **430db93**: feat(api): implement kingdom management services (TICKET-006 Stage 3)
  - PartyService: Full CRUD + archive/restore (no cascade)
  - KingdomService: Full CRUD + archive/restore + cascade delete to Settlements→Structures
  - SettlementService: Full CRUD + archive/restore + cascade delete to Structures
  - StructureService: Full CRUD + archive/restore (no cascade)
  - 150 tests passing (13 test suites, all tests green)
  - Location validation for settlements (world-scoping, uniqueness)
  - Comprehensive authorization checks (owner/GM permissions)
  - Audit logging for all mutations
