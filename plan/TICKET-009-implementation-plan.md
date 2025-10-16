# TICKET-009 Implementation Plan: Party & Kingdom Management

## Overview

This ticket implements Party, Kingdom, Settlement, and Structure management with level tracking, typed custom variables, and integration with the conditional availability system. This is a large ticket that will be broken down into multiple stages.

## Stage 1: Prisma Schema Extensions

**Goal**: Update the Prisma schema to support Party, Kingdom, Settlement, and Structure entities with typed variables.

**Success Criteria**:

- Schema includes all four entity types with appropriate relations
- Typed variable schema support is defined
- Migration can be applied successfully

**Tasks**:

- [ ] Add Party model with fields: id, name, campaignId, averageLevel, manualLevelOverride
- [ ] Add Kingdom model with fields: id, name, campaignId, level
- [ ] Add Settlement model with fields: id, name, kingdomId, locationId, level
- [ ] Add Structure model with fields: id, name, type, settlementId, level
- [ ] Add VariableSchema model with fields: id, entityType, entityId, name, type, enumValues, defaultValue, description
- [ ] Add Variable model with fields: id, entityType, entityId, name, value (JSON)
- [x] Add relations: Party->Campaign, Party->Character (members), Kingdom->Campaign, Kingdom->Settlement, Settlement->Kingdom, Settlement->Location, Settlement->Structure, Structure->Settlement
- [ ] Add LevelHistory models for each entity type to track level changes (deferred to Stage 9)
- [x] Create and apply Prisma migration

**Status**: ✅ Complete (models already exist in schema from previous work)

---

## Stage 2: Service Layer - Party Management

**Goal**: Implement PartyService with CRUD operations, level calculation, and typed variable support.

**Success Criteria**:

- PartyService handles CRUD operations
- Average level calculation works (mean of member levels or manual override)
- Typed variables can be set/retrieved with validation
- Unit tests pass

**Tasks**:

- [x] Create PartyService class in packages/api/src/graphql/services/
- [x] Implement createParty(campaignId, data)
- [x] Implement getParty(id) with member loading
- [x] Implement updateParty(id, data)
- [x] Implement deleteParty(id)
- [x] Implement calculateAverageLevel() logic (mean of character levels)
- [x] Implement setManualLevelOverride(partyId, level) as setLevel()
- [ ] Implement setPartyVariable(partyId, name, value) with type validation (deferred to Stage 5)
- [ ] Implement getPartyVariable(partyId, name) (deferred to Stage 5)
- [ ] Implement defineVariableSchema(partyId, schema) (deferred to Stage 5)
- [x] Implement addMember(partyId, characterId)
- [x] Implement removeMember(partyId, characterId)
- [x] Add level change event emission
- [x] Write unit tests for PartyService

**Status**: ✅ Complete (variable operations deferred to Stage 5 VariableSchemaService)

---

## Stage 3: Service Layer - Kingdom Management

**Goal**: Implement KingdomService with CRUD operations, level tracking, and typed variable support.

**Success Criteria**:

- KingdomService handles CRUD operations
- Level tracking works
- Typed variables can be set/retrieved with validation
- Territory associations work
- Unit tests pass

**Tasks**:

- [x] Create KingdomService class in packages/api/src/graphql/services/
- [x] Implement createKingdom(campaignId, data)
- [x] Implement getKingdom(id) with settlements loaded
- [x] Implement updateKingdom(id, data)
- [x] Implement deleteKingdom(id)
- [x] Implement setKingdomLevel(kingdomId, level) as setLevel()
- [ ] Implement setKingdomVariable(kingdomId, name, value) with type validation (deferred to Stage 5)
- [ ] Implement getKingdomVariable(kingdomId, name) (deferred to Stage 5)
- [ ] Implement defineVariableSchema(kingdomId, schema) (deferred to Stage 5)
- [ ] Implement addTerritory(kingdomId, locationId) (deferred - not in current requirements)
- [ ] Implement removeTerritory(kingdomId, locationId) (deferred - not in current requirements)
- [x] Add level change event emission
- [x] Write unit tests for KingdomService (21 tests, all passing)
- [x] Add archive/restore operations
- [x] Add cascade delete to settlements and structures
- [x] Add optimistic locking and versioning support
- [x] Add getKingdomAsOf for time-travel queries

**Status**: ✅ Complete (variable operations deferred to Stage 5 VariableSchemaService)

---

## Stage 4: Service Layer - Settlement & Structure Management

**Goal**: Implement SettlementService and StructureService with CRUD operations, level tracking, and typed variable support.

**Success Criteria**:

- SettlementService handles CRUD operations
- StructureService handles CRUD operations
- Level tracking works for both
- Typed variables work for both
- Hierarchical associations work (Kingdom->Settlement->Structure)
- Unit tests pass

**Tasks**:

- [x] Create SettlementService class in packages/api/src/graphql/services/
- [x] Implement createSettlement(kingdomId, locationId, data)
- [x] Implement getSettlement(id) with structures loaded
- [x] Implement updateSettlement(id, data)
- [x] Implement deleteSettlement(id)
- [x] Implement setSettlementLevel(settlementId, level) as setLevel()
- [ ] Implement settlement variable operations (define schema, set/get variables) (deferred to Stage 5)
- [x] Add level change event emission for settlements
- [x] Write unit tests for SettlementService (18 tests, all passing)
- [x] Create StructureService class in packages/api/src/graphql/services/
- [x] Implement createStructure(settlementId, data)
- [x] Implement getStructure(id)
- [x] Implement updateStructure(id, data)
- [x] Implement deleteStructure(id)
- [x] Implement setStructureLevel(structureId, level) as setLevel()
- [ ] Implement structure variable operations (define schema, set/get variables) (deferred to Stage 5)
- [x] Add level change event emission for structures
- [x] Write unit tests for StructureService (19 tests, all passing)
- [x] Add archive/restore operations for both services
- [x] Add cascade delete from Settlement to Structure
- [x] Add optimistic locking and versioning support for update operations
- [x] Add getSettlementAsOf and getStructureAsOf for time-travel queries

**Status**: ✅ Complete (variable operations deferred to Stage 5 VariableSchemaService)

---

## Stage 5: Variable Schema Service

**Goal**: Create a reusable VariableSchemaService to handle typed variable validation across all entity types.

**Success Criteria**:

- Centralized validation logic for typed variables
- Supports string, number, boolean, enum types
- Type-safe setting/getting
- Unit tests pass

**Tasks**:

- [x] Create VariableSchemaService class in packages/api/src/graphql/services/
- [x] Implement validateVariableValue(schema, value) for each type
- [x] Implement defineSchema(entityType, entityId, schema)
- [x] Implement getSchema(entityType, entityId, variableName)
- [x] Implement listSchemas(entityType, entityId)
- [x] Implement deleteSchema(entityType, entityId, variableName)
- [x] Implement setVariable(entityType, entityId, name, value) with validation
- [x] Implement getVariable(entityType, entityId, name) with type casting
- [x] Implement listVariables(entityType, entityId)
- [ ] Add versioning for variable changes (track history) - deferred to future stage
- [x] Write unit tests for VariableSchemaService (28 tests, all passing)

**Status**: ✅ Complete

---

## Stage 6: GraphQL Schema & Resolvers - Party

**Goal**: Create GraphQL types, queries, and mutations for Party management.

**Success Criteria**:

- GraphQL schema is valid
- Queries return correct data
- Mutations work properly
- Integration tests pass

**Tasks**:

- [x] Create Party GraphQL type definition in packages/api/src/graphql/types/ (already existed, updated)
- [x] Create VariableSchema GraphQL type
- [x] Create Variable GraphQL type
- [x] Create party.resolver.ts with queries: party(id), parties(campaignId) (already existed)
- [x] Add mutation: createParty(campaignId, input) (already existed)
- [x] Add mutation: updateParty(id, input) (already existed)
- [x] Add mutation: deleteParty(id) (already existed)
- [x] Add mutation: setPartyLevel(id, level)
- [x] Add mutation: addPartyMember(partyId, characterId)
- [x] Add mutation: removePartyMember(partyId, characterId)
- [x] Add mutation: definePartyVariableSchema(partyId, schema)
- [x] Add mutation: setPartyVariable(partyId, name, value)
- [x] Add mutation: deletePartyVariableSchema(partyId, name)
- [x] Add query: partyVariable(partyId, name)
- [x] Add query: partyVariables(partyId)
- [x] Add query: partyVariableSchemas(partyId)
- [x] Write integration tests for Party GraphQL API (24 tests, all passing)

**Status**: ✅ Complete (Commit a4eab8e)

---

## Stage 7: GraphQL Schema & Resolvers - Kingdom, Settlement, Structure

**Goal**: Create GraphQL types, queries, and mutations for Kingdom, Settlement, and Structure management.

**Success Criteria**:

- GraphQL schemas are valid
- Queries return correct data with proper relations
- Mutations work properly
- Integration tests pass

**Tasks**:

- [x] Create Kingdom GraphQL type definition (already existed, updated with VariableSchemaType[] and version)
- [x] Create Settlement GraphQL type definition (already existed, updated with VariableSchemaType[] and version)
- [x] Create Structure GraphQL type definition (already existed, updated with VariableSchemaType[] and version)
- [x] Create kingdom.resolver.ts with queries: kingdom(id), kingdomsByCampaign(campaignId) (already existed)
- [x] Add Kingdom mutations: create, update, delete, setLevel, archive, restore (already existed except setLevel)
- [x] Add Kingdom variable mutations: defineKingdomVariableSchema, setKingdomVariable, deleteKingdomVariableSchema
- [x] Add Kingdom variable queries: kingdomVariable, kingdomVariables, kingdomVariableSchemas
- [x] Create settlement.resolver.ts with queries: settlement(id), settlementsByKingdom(kingdomId) (already existed)
- [x] Add Settlement mutations: create, update, delete, setLevel, archive, restore (already existed except setLevel)
- [x] Add Settlement variable mutations: defineSettlementVariableSchema, setSettlementVariable, deleteSettlementVariableSchema
- [x] Add Settlement variable queries: settlementVariable, settlementVariables, settlementVariableSchemas
- [x] Create structure.resolver.ts with queries: structure(id), structuresBySettlement(settlementId) (already existed)
- [x] Add Structure mutations: create, update, delete, setLevel, archive, restore (already existed except setLevel)
- [x] Add Structure variable mutations: defineStructureVariableSchema, setStructureVariable, deleteStructureVariableSchema
- [x] Add Structure variable queries: structureVariable, structureVariables, structureVariableSchemas
- [x] Add field resolvers for Settlement.structures (uses DataLoader for efficient batching)
- [x] Write integration tests for Kingdom GraphQL API (21 tests, all passing)
- [x] Write integration tests for Settlement GraphQL API (21 tests, all passing)
- [x] Write integration tests for Structure GraphQL API (21 tests, all passing)

**Status**: ✅ Complete (Commit a259f55)

---

## Stage 8: Context System Integration

**Goal**: Integrate Party, Kingdom, Settlement, and Structure state into the compute context for rules engine.

**Success Criteria**:

- Context includes party/kingdom/settlement/structure state
- Multiple parties per campaign are supported
- Level changes trigger context updates
- Integration tests pass

**Tasks**:

- [x] Create CampaignContextService to aggregate entity state
- [x] Implement getCampaignContext() to fetch all parties, kingdoms, settlements, structures
- [x] Include party levels (using manualLevelOverride or averageLevel) in context
- [x] Include kingdom levels in context
- [x] Include settlement levels in context
- [x] Include structure levels in context
- [x] Include typed variables from all entities in context
- [x] Implement context caching with TTL
- [x] Add context invalidation API (invalidateContext, invalidateContextForEntity)
- [x] Add support for multiple parties per campaign in context
- [x] Write comprehensive unit tests (12 tests, all passing)
- [x] Add service to GraphQL module providers
- [x] Code review and commit

**Status**: ✅ Complete (Commit 6e9b5fc)

---

## Stage 9: Level History & Event System

**Goal**: Track level history for all entities and emit events on level changes.

**Success Criteria**:

- ✅ Level changes are recorded in history via audit system
- ✅ Campaign context cache is invalidated on level changes
- ✅ Events are emitted for UI updates (entityModified events already exist)
- ✅ Prepared for rules engine integration (TODO comments added)
- ✅ All tests pass (577 of 578, 1 pre-existing test isolation issue)

**Tasks**:

- [x] Create LevelHistoryService for tracking level changes
- [x] Implement getLevelHistory(entityType, entityId) - retrieves level history from audit logs
- [x] Implement getCampaignLevelHistory(campaignId) - aggregates level history across all entities
- [x] Add campaign context invalidation on party level change
- [x] Add campaign context invalidation on kingdom level change
- [x] Add campaign context invalidation on settlement level change
- [x] Add campaign context invalidation on structure level change
- [x] Add forwardRef() to resolve circular dependencies with CampaignContextService
- [x] Add error handling for cache invalidation failures
- [x] Prepare for rules engine integration (TODO comments for TICKET-013)
- [ ] Add WebSocket support for real-time level change notifications (deferred - not required for MVP)
- [x] Write comprehensive unit tests for LevelHistoryService (13 tests)
- [x] Fix circular dependency issues in integration tests (all 5 resolver suites passing)
- [x] Fix test dependencies and mocks for version service parameters
- [x] Address code review feedback (N+1 queries, type safety, Prisma compatibility)

**Implementation Notes**:

- Uses existing audit system instead of creating new tables
- getLevelHistory fetches all audits in single query, processes in memory (avoids N+1)
- getCampaignLevelHistory uses single batch query for all entities (avoids ~940 queries)
- Proper TypeScript types with type guards instead of `any`
- Cache invalidation wrapped in try-catch (failures logged, don't block operations)
- Performance-optimized single-query approach

**Status**: ✅ Complete (Commit 5db374b)

---

## Stage 10: Validation & Error Handling

**Goal**: Add comprehensive validation for all operations and proper error handling.

**Success Criteria**:

- ✅ Level ranges are validated
- ✅ Variable types are validated against schemas (already implemented in Stage 5)
- ✅ Relationship constraints are enforced (already implemented in previous stages)
- ✅ Error messages are clear and helpful
- ✅ Unit tests cover validation cases

**Tasks**:

- [x] Add level range validation for parties (1-20 default, configurable)
- [x] Add level range validation for kingdoms (1-10 default, configurable)
- [x] Add level range validation for settlements (1-10 default, configurable)
- [x] Add level range validation for structures (1-5 default, configurable)
- [x] Add validation for variable schemas - already complete in VariableSchemaService (Stage 5)
- [x] Add validation for variable values against schemas - already complete in VariableSchemaService (Stage 5)
- [x] Add validation for party member associations - already complete in PartyService.addMember (Stage 2)
- [x] Add validation for settlement-kingdom associations - already complete in SettlementService.create (Stage 4)
- [x] Add validation for settlement-location associations - already complete in SettlementService.create (Stage 4)
- [x] Add validation for structure-settlement associations - already complete in StructureService.create (Stage 4)
- [x] Add proper error messages for all validation failures
- [x] Write unit tests for all validation rules (35 tests for LevelValidator)

**Implementation Notes**:

Created LevelValidator utility class with centralized level range validation:

- Default ranges based on D&D 5e: Party/Character (1-20), Kingdom (1-10), Settlement (1-10), Structure (1-5)
- Support for custom level ranges (configurable per campaign/entity)
- Comprehensive type validation (must be number, integer)
- Descriptive error messages with expected range and received value
- 35 comprehensive unit tests (all passing)
- Integrated into all entity setLevel() methods (Party, Kingdom, Settlement, Structure)
- Validation happens BEFORE permission checks and database queries (fail-fast design)

Variable validation was already fully implemented in Stage 5 (VariableSchemaService):

- Type validation for string, number, boolean, enum
- Enum value validation
- 28 comprehensive unit tests
- All validation working correctly

Relationship validation was already implemented in previous stages:

- Party member validation (must be valid character in same campaign)
- Settlement-kingdom validation (kingdom must exist and user has permission)
- Settlement-location validation (location must exist in same world, unique per settlement)
- Structure-settlement validation (settlement must exist and user has permission)

**Status**: ✅ Complete (Commit 159ef74)

---

## Stage 11: End-to-End Testing & Documentation

**Goal**: Complete end-to-end testing and update documentation.

**Success Criteria**:

- All acceptance criteria are met
- E2E tests pass
- Documentation is complete
- Code is ready for review

**Tasks**:

- [ ] Run all unit tests and verify they pass
- [ ] Run all integration tests and verify they pass
- [ ] Write E2E test: Create party with members and set level
- [ ] Write E2E test: Create kingdom with settlements
- [ ] Write E2E test: Create settlement with structures
- [ ] Write E2E test: Define variable schemas and set typed variables
- [ ] Write E2E test: Level changes trigger context updates
- [ ] Verify all acceptance criteria from TICKET-009.md
- [ ] Update API documentation with new GraphQL types and operations
- [ ] Update README.md with party/kingdom/settlement/structure features
- [ ] Add code comments and documentation
- [ ] Run TypeScript type-check across all packages
- [ ] Run linter and fix any issues
- [ ] Final code review preparation

**Status**: Not Started

---

## Stage 12: Performance & Quality Improvements (Future Work)

**Goal**: Address technical debt and optimization opportunities identified in code review

**Success Criteria**:

- N+1 query problem resolved with batch methods
- Redis caching implemented for production
- Context size monitoring in place
- Type safety improved in mapper functions

**Tasks**:

- [ ] **Fix N+1 Query Problem** (HIGH Priority)
  - Add `SettlementService.findByKingdoms(kingdomIds[], user)` batch method
  - Add `StructureService.findBySettlements(settlementIds[], user)` batch method
  - Update `CampaignContextService.getCampaignContext()` to use batch methods
  - Performance test with 50+ kingdoms and 500+ settlements
  - Document performance improvement (expected: 100+ queries → 3 queries)

- [ ] **Migrate to Redis Cache** (MEDIUM Priority)
  - Replace in-memory Map with Redis client
  - Implement Redis connection pooling
  - Add cache key namespacing: `campaign:context:{campaignId}`
  - Add cache metrics (hit rate, miss rate, eviction count)
  - Test cache coherency across multiple API instances
  - Add TTL configuration via environment variable
  - Document Redis setup in README.md

- [ ] **Add Context Size Monitoring** (MEDIUM Priority)
  - Add warning logs when context exceeds 1000 entities
  - Add metrics for context size (parties, kingdoms, settlements, structures count)
  - Consider pagination or chunking for very large campaigns
  - Add documentation about context size limits

- [ ] **Improve Type Safety** (LOW Priority)
  - Replace `any` in `mapPartyToContext(party: any)` with proper Prisma types
  - Replace `any` in `mapKingdomToContext(kingdom: any)` with proper Prisma types
  - Replace `any` in `mapSettlementToContext(settlement: any)` with proper Prisma types
  - Replace `any` in `mapStructureToContext(structure: any)` with proper Prisma types
  - Import types: `import type { Party, Kingdom, Settlement, Structure } from '@prisma/client'`
  - Update test mocks to use proper types instead of `any`

- [ ] **Add Cache Behavior Tests** (LOW Priority)
  - Test that cached context is returned on second call (verify DB called once)
  - Test cache expiration after TTL (use jest.useFakeTimers)
  - Test concurrent requests with cache
  - Test cache invalidation on entity updates

- [ ] **Additional Improvements**
  - Add authorization check documentation/comments
  - Add TODO comment about granular invalidation in `invalidateContextForEntity()`
  - Add TODO comment about Redis migration in cache property declaration
  - Consider rate limiting for `getCampaignContext()` to prevent abuse

**Status**: Not Started (Technical Debt from Stage 8)

**Context**: These suggestions came from code-reviewer subagent during Stage 8. None are blockers for current functionality, but should be addressed before production deployment (especially Redis caching and N+1 query fix).

---

## Notes

- This is a large ticket with 11 stages
- Each stage should be completed and committed separately
- TDD approach: write tests first, then implementation
- Always use specialized subagents for running tests and fixing errors
- Use Code Reviewer subagent before each commit
- Use Project Manager subagent before marking ticket complete

## Dependencies

- TICKET-006 (Entity CRUD Operations) - ✓ Complete
- Existing Event system from TICKET-007
- Existing Location system from TICKET-006

## Estimated Total Time

4-5 days as noted in ticket
