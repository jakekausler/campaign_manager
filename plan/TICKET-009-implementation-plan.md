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

- [ ] Create Party GraphQL type definition in packages/api/src/graphql/types/
- [ ] Create PartyMember type (joins Party and Character)
- [ ] Create VariableSchema GraphQL type
- [ ] Create Variable GraphQL type
- [ ] Create party.resolver.ts with queries: party(id), parties(campaignId)
- [ ] Add mutation: createParty(campaignId, input)
- [ ] Add mutation: updateParty(id, input)
- [ ] Add mutation: deleteParty(id)
- [ ] Add mutation: setPartyLevel(id, level)
- [ ] Add mutation: addPartyMember(partyId, characterId)
- [ ] Add mutation: removePartyMember(partyId, characterId)
- [ ] Add mutation: definePartyVariableSchema(partyId, schema)
- [ ] Add mutation: setPartyVariable(partyId, name, value)
- [ ] Add query: partyVariable(partyId, name)
- [ ] Add query: partyVariableSchemas(partyId)
- [ ] Write integration tests for Party GraphQL API

**Status**: Not Started

---

## Stage 7: GraphQL Schema & Resolvers - Kingdom, Settlement, Structure

**Goal**: Create GraphQL types, queries, and mutations for Kingdom, Settlement, and Structure management.

**Success Criteria**:

- GraphQL schemas are valid
- Queries return correct data with proper relations
- Mutations work properly
- Integration tests pass

**Tasks**:

- [ ] Create Kingdom GraphQL type definition
- [ ] Create Settlement GraphQL type definition
- [ ] Create Structure GraphQL type definition
- [ ] Create kingdom.resolver.ts with queries: kingdom(id), kingdoms(campaignId)
- [ ] Add Kingdom mutations: create, update, delete, setLevel, addTerritory, removeTerritory
- [ ] Add Kingdom variable mutations: defineSchema, setVariable
- [ ] Create settlement.resolver.ts with queries: settlement(id), settlements(kingdomId)
- [ ] Add Settlement mutations: create, update, delete, setLevel
- [ ] Add Settlement variable mutations: defineSchema, setVariable
- [ ] Create structure.resolver.ts with queries: structure(id), structures(settlementId)
- [ ] Add Structure mutations: create, update, delete, setLevel
- [ ] Add Structure variable mutations: defineSchema, setVariable
- [ ] Add field resolvers for nested relationships (Kingdom.settlements, Settlement.structures, etc.)
- [ ] Write integration tests for Kingdom GraphQL API
- [ ] Write integration tests for Settlement GraphQL API
- [ ] Write integration tests for Structure GraphQL API

**Status**: Not Started

---

## Stage 8: Context System Integration

**Goal**: Integrate Party, Kingdom, Settlement, and Structure state into the compute context for rules engine.

**Success Criteria**:

- Context includes party/kingdom/settlement/structure state
- Multiple parties per campaign are supported
- Level changes trigger context updates
- Integration tests pass

**Tasks**:

- [ ] Update ContextService to include party state
- [ ] Update ContextService to include kingdom state
- [ ] Update ContextService to include settlement state
- [ ] Update ContextService to include structure state
- [ ] Add party.average_level to context variables
- [ ] Add kingdom.level to context variables
- [ ] Add settlement.level to context variables
- [ ] Add structure.level to context variables
- [ ] Add typed variables from all entities to context
- [ ] Update context invalidation on level changes
- [ ] Update context invalidation on variable changes
- [ ] Add support for multiple parties per campaign in context
- [ ] Write integration tests for context system updates

**Status**: Not Started

---

## Stage 9: Level History & Event System

**Goal**: Track level history for all entities and emit events on level changes.

**Success Criteria**:

- Level changes are recorded in history
- Events are emitted for UI updates
- Rules engine recalculation is triggered
- Integration tests pass

**Tasks**:

- [ ] Create LevelHistoryService for tracking level changes
- [ ] Implement recordLevelChange(entityType, entityId, oldLevel, newLevel, reason)
- [ ] Implement getLevelHistory(entityType, entityId)
- [ ] Add event emission on party level change
- [ ] Add event emission on kingdom level change
- [ ] Add event emission on settlement level change
- [ ] Add event emission on structure level change
- [ ] Integrate with rules engine invalidation
- [ ] Add WebSocket support for real-time level change notifications
- [ ] Write integration tests for level history tracking
- [ ] Write integration tests for event emission

**Status**: Not Started

---

## Stage 10: Validation & Error Handling

**Goal**: Add comprehensive validation for all operations and proper error handling.

**Success Criteria**:

- Level ranges are validated
- Variable types are validated against schemas
- Relationship constraints are enforced
- Error messages are clear and helpful
- Unit tests cover validation cases

**Tasks**:

- [ ] Add level range validation for parties (0-20 default, configurable)
- [ ] Add level range validation for kingdoms
- [ ] Add level range validation for settlements
- [ ] Add level range validation for structures
- [ ] Add validation for variable schemas (valid types, enum values, etc.)
- [ ] Add validation for variable values against schemas
- [ ] Add validation for party member associations (must be valid characters)
- [ ] Add validation for kingdom territory associations (must be valid locations)
- [ ] Add validation for settlement-kingdom associations
- [ ] Add validation for settlement-location associations
- [ ] Add validation for structure-settlement associations
- [ ] Add proper error messages for all validation failures
- [ ] Write unit tests for all validation rules

**Status**: Not Started

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
