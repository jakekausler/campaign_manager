# TICKET-033 - Stage 5: Cascading Invalidation

## Goal

Implement intelligent cascading cache invalidation to ensure related caches are cleared when parent or dependent entities change. This ensures data consistency across the cache hierarchy.

## Context

### Prerequisites

- Stage 1-4 complete: All cache types implemented
- Understanding of entity relationships:
  - Kingdom → Settlements → Structures
  - FieldCondition changes affect all entities in campaign
  - StateVariable changes affect specific entity's computed fields

### Cascading Invalidation Flows

**Campaign-Level Changes** (FieldCondition created/updated/deleted):

- Invalidate ALL computed fields for settlements in campaign
- Invalidate ALL computed fields for structures in campaign
- Rationale: FieldConditions define computed field logic, so changes affect all entities

**Settlement Changes** (update/setLevel/delete):

- Invalidate settlement's computed fields cache
- Invalidate settlement's structures list cache
- Invalidate all structure computed fields in that settlement (they may reference parent)
- Invalidate spatial caches (settlement location may affect queries)

**Structure Changes** (update/setLevel/delete):

- Invalidate structure's computed fields cache
- Invalidate parent settlement's computed fields cache (settlement may reference child structures)
- Invalidate parent settlement's structures list cache

**StateVariable Changes** (create/update/delete):

- Invalidate the entity's computed fields cache (either settlement or structure)

### Files to Modify

- `packages/api/src/graphql/services/field-condition.service.ts` - Add campaign-level invalidation
- `packages/api/src/graphql/services/state-variable.service.ts` - Add entity-level invalidation
- `packages/api/src/graphql/services/settlement.service.ts` - Enhance invalidation to include children
- `packages/api/src/graphql/services/structure.service.ts` - Enhance invalidation to include parent
- `packages/api/src/common/cache/cache.service.ts` - Add helper methods for cascading invalidation

### Patterns to Follow

- Create reusable invalidation methods: `invalidateSettlementCascade()`, `invalidateStructureCascade()`
- Use pattern-based deletion for campaign-level invalidation: `computed-fields:*:{branchId}`
- Query for related entities before invalidating (e.g., fetch all structureIds before invalidating)
- Log invalidation operations for debugging
- Consider using Redis transactions (MULTI/EXEC) for atomic invalidation

### Challenges

- Performance: Cascading invalidation shouldn't be slower than the cache benefit
- Correctness: Must invalidate all affected caches without over-invalidating
- Race conditions: Updates during invalidation should be handled gracefully

## Tasks

### Development Tasks

- [ ] Add helper method to CacheService: `invalidatePattern(pattern: string)` for wildcard deletion
- [ ] Add helper method to CacheService: `invalidateSettlementCascade(settlementId, branchId)`
- [ ] Add helper method to CacheService: `invalidateStructureCascade(structureId, settlementId, branchId)`
- [ ] Add helper method to CacheService: `invalidateCampaignComputedFields(campaignId, branchId)`
- [ ] Modify FieldConditionService.create() to call `invalidateCampaignComputedFields()`
- [ ] Modify FieldConditionService.update() to call `invalidateCampaignComputedFields()`
- [ ] Modify FieldConditionService.delete() to call `invalidateCampaignComputedFields()`
- [ ] Modify StateVariableService.create() to invalidate entity's computed fields
- [ ] Modify StateVariableService.update() to invalidate entity's computed fields
- [ ] Modify StateVariableService.delete() to invalidate entity's computed fields
- [ ] Enhance SettlementService invalidation to use `invalidateSettlementCascade()`
- [ ] Enhance StructureService invalidation to use `invalidateStructureCascade()`
- [ ] Add logging for all cascade operations (info level)

### Testing Tasks

- [ ] Write unit test: FieldCondition change invalidates all computed fields in campaign
- [ ] Write unit test: StateVariable change invalidates entity's computed fields
- [ ] Write unit test: Settlement update invalidates settlement + structures cascade
- [ ] Write unit test: Structure update invalidates structure + parent settlement
- [ ] Write integration test: End-to-end cascade with real entities and Redis
- [ ] Write integration test: Verify no over-invalidation (unrelated entities unaffected)
- [ ] Write integration test: Race condition handling (concurrent updates during invalidation)

### Quality Assurance Tasks

- [ ] Run tests (use TypeScript Tester subagent)
- [ ] Fix test failures (if any exist from previous task)
- [ ] Run type-check and lint (use TypeScript Fixer subagent)
- [ ] Fix type/lint errors (if any exist from previous task)

### Review and Commit Tasks

- [ ] Run code review (use Code Reviewer subagent - MANDATORY)
- [ ] Address code review feedback (if any exists from previous task)
- [ ] Commit stage changes with detailed conventional commit message

## Implementation Notes

[Add notes here as tasks are completed]

## Commit Hash

[Added when final commit task is complete]
