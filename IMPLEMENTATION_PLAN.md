# TICKET-006: Entity CRUD Operations - Implementation Plan

## Overview

Implementing complete CRUD operations for all core domain entities with soft delete, archive functionality, cascade delete logic, and comprehensive audit logging.

## Stage 1: Foundation (In Progress)

**Goal**: Set up shared infrastructure and patterns
**Success Criteria**:

- [x] archivedAt field added to database schema
- [ ] Audit service created for mutation logging
- [ ] Shared pagination types and utilities
- [ ] Shared filter input types
- [ ] Base patterns documented

**Status**: In Progress

## Stage 2: Core Services (First Batch)

**Goal**: Implement World, Campaign, and Character services with full CRUD
**Success Criteria**:

- [ ] WorldService: CRUD + archive + cascade delete (to Campaigns and Locations)
- [ ] CampaignService: CRUD + archive + cascade delete (to Events, Encounters, etc.)
- [ ] CharacterService: CRUD + archive (no cascade)
- [ ] All have audit logging
- [ ] Tests written and passing for each service

**Status**: Not Started

## Stage 3: Kingdom Management Services

**Goal**: Implement Party, Kingdom, Settlement, and Structure services
**Success Criteria**:

- [ ] PartyService: CRUD + archive
- [ ] KingdomService: CRUD + archive + cascade delete (to Settlements)
- [ ] SettlementService: CRUD + archive + cascade delete (to Structures)
- [ ] StructureService: CRUD + archive
- [ ] Tests written and passing for each service

**Status**: Not Started

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

- Stage 1: ~20% complete (schema updated, migration applied)
- Estimated remaining time: 3-4 days
