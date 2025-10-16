# TICKET-007: Versioning System Implementation - Implementation Plan

## Overview

Implement a bitemporal versioning system that tracks all changes to entities over world-time, enabling time-travel queries, audit trails, concurrent edit detection, and support for branching timelines.

## Implementation Strategy

This implementation will be done in 5 stages, following TDD principles where applicable. Each stage builds upon the previous one, with comprehensive testing at each step.

---

## Stage 1: Database Schema & Core Infrastructure

**Goal**: Update Prisma schema for versioning with compression, add optimistic locking, and install required dependencies

**Success Criteria**:

- Version model updated with payloadGz (Bytes) for compressed storage
- Version field added to all versionable entities for optimistic locking
- Required npm packages installed (no new dependencies needed - using Node.js zlib)
- Prisma migration created and applied
- Database schema validated

**Tasks**:

- [ ] Review current Version model in schema.prisma
- [ ] Update Version model to include:
  - Change `payloadJson Json` to `payloadGz Bytes` for compressed storage
  - Add `comment String?` for optional change comments
  - Add `version Int` field for optimistic locking
  - Update indexes to include version field: `@@index([entityType, entityId, version])`
- [ ] Add `version Int @default(1)` field to all versionable entities:
  - World
  - Campaign
  - Location
  - Party
  - Kingdom
  - Settlement
  - Structure
  - Character
  - Encounter
  - Event
- [ ] Create Prisma migration with descriptive name: `add-versioning-system`
- [ ] Apply migration to development database
- [ ] Verify migration success and database state
- [ ] Document rollback procedure in case migration needs to be reverted
- [ ] Test migration rollback capability if needed: `prisma migrate resolve --rolled-back <migration_name>`
- [ ] Commit changes

**Tests**: N/A (schema changes verified by Prisma validation and migration success)

**Status**: Not Started

---

## Stage 2: Version Utilities & Compression

**Goal**: Implement compression, decompression, and diff calculation utilities with comprehensive tests

**Success Criteria**:

- Compression/decompression functions implemented using Node.js zlib
- Compression reduces payload size significantly
- Decompression correctly restores original data
- Diff calculator shows accurate added/modified/removed fields
- All utility functions have comprehensive unit tests
- Tests verify round-trip fidelity and edge cases

**Tasks**:

- [ ] Create utility file: `packages/api/src/graphql/utils/version.utils.ts`
- [ ] Implement compression functions:
  - `compressPayload(payload: object): Promise<Buffer>` - uses zlib.gzip
  - `decompressPayload(compressed: Buffer): Promise<object>` - uses zlib.gunzip
- [ ] Implement diff calculation:
  - Define `VersionDiff` interface (added, modified, removed)
  - `calculateDiff(oldPayload: object, newPayload: object): VersionDiff`
  - Helper functions: getAddedFields, getModifiedFields, getRemovedFields
- [ ] Write comprehensive unit tests in `version.utils.test.ts`:
  - Test compression reduces size
  - Test decompression restores original data
  - Test round-trip (compress → decompress → equals original)
  - Test diff with added fields
  - Test diff with modified fields
  - Test diff with removed fields
  - Test diff with nested objects
  - Test diff with arrays
  - Test edge cases (empty objects, null values, undefined)
- [ ] Use TypeScript Tester subagent to run and debug tests
- [ ] Use TypeScript Fixer for any type errors
- [ ] Commit changes

**Tests**:

- [ ] Compression reduces payload size
- [ ] Decompression restores original exactly
- [ ] Round-trip preserves data integrity
- [ ] Diff accurately detects all change types
- [ ] Edge cases handled correctly

**Status**: Not Started

---

## Stage 3: VersionService Implementation

**Goal**: Create VersionService with version CRUD, resolution logic, and branch inheritance

**Success Criteria**:

- VersionService created following existing service patterns
- Can create new versions with compressed payloads
- Can query version history for an entity
- Can resolve version at specific branch and world time
- Branch inheritance works (child branches inherit parent versions)
- Can restore entity to previous version
- Can close current version when creating new one
- All service methods have comprehensive unit tests

**Tasks**:

- [ ] Create service file: `packages/api/src/graphql/services/version.service.ts`
- [ ] Implement VersionService class structure:
  - Constructor with PrismaService, AuditService dependencies
  - Follow existing service patterns (see campaign.service.ts)
- [ ] Implement core version methods:
  - `createVersion(input: CreateVersionInput, user: AuthenticatedUser): Promise<Version>`
    - Compress payload before storage
    - Store in payloadGz field
    - Log audit entry
  - `closeVersion(versionId: string, validTo: Date): Promise<Version>`
    - Update validTo field to close current version
  - `findVersionHistory(entityType: string, entityId: string, branchId: string): Promise<Version[]>`
    - Query all versions for entity in chronological order
- [ ] Implement version resolution logic:
  - `resolveVersion(entityType: string, entityId: string, branchId: string, asOf: Date): Promise<Version | null>`
    - Try to find version in current branch
    - If not found, walk up branch ancestry chain
    - Use helper method `findVersionInBranch`
  - `findVersionInBranch(entityType, entityId, branchId, asOf): Promise<Version | null>`
    - Query with validFrom <= asOf AND (validTo > asOf OR validTo IS NULL)
- [ ] Implement version diff and restore:
  - `getVersionDiff(versionId1: string, versionId2: string): Promise<VersionDiff>`
    - Fetch both versions
    - Decompress payloads
    - Call calculateDiff utility
  - `restoreVersion(versionId: string, user: AuthenticatedUser): Promise<Version>`
    - Fetch historical version
    - Create new version with same payload but current validFrom
- [ ] Write comprehensive unit tests in `version.service.test.ts`:
  - Mock PrismaService and AuditService
  - Test version creation with compression
  - Test version closure
  - Test version history query
  - Test version resolution in same branch
  - Test branch inheritance resolution
  - Test version diff calculation
  - Test version restore
  - Test edge cases (no versions, multiple branches, etc.)
- [ ] Use TypeScript Tester subagent to run and debug tests
- [ ] Use TypeScript Fixer for any type errors
- [ ] Commit changes

**Tests**:

- [ ] Creating version compresses and stores payload
- [ ] Closing version updates validTo
- [ ] Version history returns chronological list
- [ ] Version resolution finds correct version in branch
- [ ] Branch inheritance walks up ancestry chain
- [ ] Version diff shows accurate changes
- [ ] Restore creates new version with old payload
- [ ] Edge cases handled properly

**Status**: Not Started

---

## Stage 4: Entity Service Integration & Optimistic Locking

**Goal**: Integrate versioning into entity update operations with optimistic locking to prevent concurrent saves

**Success Criteria**:

- All entity services create versions on update operations
- Optimistic locking implemented using version field
- Version mismatch throws OptimisticLockException
- Entity version incremented atomically with update
- All entity fields properly versioned (no exceptions)
- getEntityAsOf methods implemented for time-travel queries
- Integration tests verify version creation on updates
- Tests verify optimistic locking prevents concurrent saves

**Tasks**:

- [ ] Create OptimisticLockException class in `packages/api/src/graphql/exceptions/`
- [ ] Update CampaignService as reference implementation:
  - Inject VersionService into constructor
  - Modify `update()` method:
    - Accept `expectedVersion: number` parameter
    - Check current.version === expectedVersion, throw OptimisticLockException if mismatch
    - Get current entity state
    - Create version snapshot with compressed payload (all fields)
    - Update entity with new version number (current.version + 1)
    - Use Prisma transaction for atomic version + entity update:
      - Use `prisma.$transaction()` to wrap version creation + entity update
      - Ensure rollback on any failure
      - Example: `await prisma.$transaction([versionCreate, entityUpdate])`
  - Add `getCampaignAsOf(id: string, branchId: string, worldTime: Date): Promise<Campaign | null>`
    - Resolve version at specified branch/time
    - Decompress payload
    - Map to Campaign entity
- [ ] Apply same pattern to other entity services (8 remaining):
  1. LocationService (Location entity)
  2. PartyService (Party entity)
  3. KingdomService (Kingdom entity)
  4. SettlementService (Settlement entity)
  5. StructureService (Structure entity)
  6. CharacterService (Character entity)
  7. EncounterService (Encounter entity)
  8. EventService (Event entity)
     (Total: 9 services including CampaignService)
- [ ] Write integration tests for versioned updates:
  - Test version created on entity update
  - Test all entity fields included in version payload
  - Test optimistic locking throws on version mismatch
  - Test version number increments correctly
  - Test transaction atomicity (both update or neither)
  - Test getEntityAsOf returns correct historical state
- [ ] Use TypeScript Tester subagent to run and debug tests
- [ ] Use TypeScript Fixer for any type errors
- [ ] Commit changes

**Tests**:

- [ ] Updating entity creates Version record
- [ ] All entity fields included in version payload
- [ ] Version payload is compressed
- [ ] Optimistic locking prevents concurrent saves
- [ ] Version mismatch throws OptimisticLockException
- [ ] getEntityAsOf returns correct historical state
- [ ] Transaction ensures atomicity

**Status**: Not Started

---

## Stage 5: GraphQL API & Subscriptions for Concurrent Edit Detection

**Goal**: Expose version functionality via GraphQL with subscriptions for concurrent edit notifications

**Success Criteria**:

- GraphQL types for Version and VersionDiff defined
- Queries for version history and restoration implemented
- Mutations accept expectedVersion parameter for optimistic locking
- Subscription for entityModified notifications implemented
- Redis pub/sub configured for subscriptions
- Subscription notifies when entity modified by another user
- All resolvers have integration tests
- End-to-end test of concurrent edit detection flow

**Tasks**:

- [ ] Create GraphQL type: `packages/api/src/graphql/types/version.type.ts`
  - Define Version object type with all fields
  - Define VersionDiff type (added, modified, removed)
  - Define EntityModified type for subscription payload
- [ ] Create GraphQL inputs: `packages/api/src/graphql/inputs/version.input.ts`
  - CreateVersionInput (if needed for manual version creation)
  - RestoreVersionInput
- [ ] Set up Redis pub/sub for subscriptions:
  - Verify Redis connection configuration in .env
  - Test Redis pub/sub connectivity before implementing subscriptions
  - Configure RedisPubSub in graphql.module.ts
  - Use graphql-redis-subscriptions package (already installed)
- [ ] Create VersionResolver: `packages/api/src/graphql/resolvers/version.resolver.ts`
  - Query: `entityVersions(entityType: String!, entityId: ID!, branchId: ID!): [Version!]!`
    - Returns version history for entity
  - Query: `versionDiff(versionId1: ID!, versionId2: ID!): VersionDiff!`
    - Returns diff between two versions
  - Mutation: `restoreVersion(versionId: ID!): Version!`
    - Restores entity to previous version state
  - Subscription: `entityModified(entityId: ID!): EntityModified!`
    - Subscribe to entity modification events
    - Returns { entityId, version } when entity updated
- [ ] Update entity resolvers to accept expectedVersion:
  - Modify update mutations to include `expectedVersion: Int!` parameter
  - Pass to service update method for optimistic locking
  - Publish entityModified event after successful update
  - Example: `updateCampaign(id: ID!, expectedVersion: Int!, input: UpdateCampaignInput!)`
- [ ] Implement pub/sub publishing in entity services:
  - After successful update, publish to `entity.modified.${entityId}`
  - Payload: { entityId, version: newVersion }
- [ ] Write integration tests for GraphQL API:
  - Test entityVersions query returns history
  - Test versionDiff query calculates diff
  - Test restoreVersion mutation works
  - Test update mutation with correct version succeeds
  - Test update mutation with wrong version fails
  - Test entityModified subscription receives events
  - Test concurrent edit detection end-to-end flow
- [ ] Performance testing:
  - Query version history for entity with 100+ versions
  - Verify query executes in < 100ms with proper index usage
  - Check EXPLAIN ANALYZE output for version resolution queries
- [ ] Use TypeScript Tester subagent to run and debug tests
- [ ] Use TypeScript Fixer for any type errors
- [ ] Commit changes

**Tests**:

- [ ] entityVersions query returns correct history
- [ ] versionDiff query shows accurate changes
- [ ] restoreVersion mutation recreates state
- [ ] Update with correct expectedVersion succeeds
- [ ] Update with wrong expectedVersion throws error
- [ ] entityModified subscription receives notifications
- [ ] Concurrent edit detection flow works end-to-end

**Status**: Not Started

---

## Final Verification & Documentation

**Goal**: Verify all acceptance criteria met, run Project Manager subagent, update documentation

**Success Criteria**:

- All acceptance criteria from TICKET-007 verified
- Project Manager subagent confirms completion
- All tests passing
- Code review completed
- Documentation updated

**Tasks**:

- [ ] Run all tests across the project: `pnpm run test`
- [ ] Run type-check: `pnpm run type-check`
- [ ] Run linting: `pnpm run lint`
- [ ] Verify all acceptance criteria:
  - [ ] Updating any entity creates a Version record (all fields versioned)
  - [ ] Version payloads are compressed with gzip
  - [ ] Versions are kept forever (no pruning)
  - [ ] Can query entity state as-of any world time
  - [ ] Version history shows all changes chronologically
  - [ ] Diffs accurately show what changed between versions
  - [ ] Branch inheritance resolves versions correctly
  - [ ] Can restore entity to previous version
  - [ ] Version queries perform efficiently with indexes
  - [ ] Concurrent edit detection works via GraphQL subscription
  - [ ] Optimistic locking prevents concurrent saves
  - [ ] User notified when entity modified by another user
  - [ ] Version payload validates against entity schema
  - [ ] Compression/decompression works correctly
- [ ] Stage all changes with git add
- [ ] **MANDATORY: Use Code Reviewer subagent** to review changes
- [ ] Address any critical issues flagged by Code Reviewer
- [ ] Commit final changes with detailed conventional commit message
- [ ] **MANDATORY: Use Project Manager subagent** to verify ticket completion
- [ ] Address any missing items flagged by Project Manager
- [ ] Update TICKET-007.md with:
  - Mark as completed
  - Add all commit hashes
  - Document implementation notes and decisions
- [ ] Update plan/EPIC.md to mark TICKET-007 as complete
- [ ] Update README.md if needed (add versioning documentation)
- [ ] Update CLAUDE.md if needed (add versioning patterns)

**Status**: Not Started

---

## Dependencies & Prerequisites

- TICKET-006 (Entity CRUD Operations) - **COMPLETED** ✅
- TICKET-005 (GraphQL Subscriptions infrastructure) - Already configured ✅
- Prisma schema with Version model - Already exists ✅
- Redis for pub/sub - Already installed ✅

## Estimated Timeline

- Stage 1: 4-6 hours (schema changes, migration)
- Stage 2: 4-6 hours (utilities, tests)
- Stage 3: 8-10 hours (VersionService, comprehensive tests)
- Stage 4: 12-16 hours (integrate 9 entity services, tests)
- Stage 5: 8-10 hours (GraphQL API, subscriptions, tests)
- Final verification: 2-4 hours

**Total**: 38-52 hours (4-6 days)

## Notes

- Follow TDD principles throughout (write tests first when feasible)
- Use TypeScript Tester subagent for all test running and debugging
- Use TypeScript Fixer subagent for all type/lint errors
- Use Code Reviewer subagent before ALL commits
- Use Project Manager subagent before marking ticket complete
- Commit at the end of each stage
- Update implementation plan as tasks are completed
- Document any architectural decisions or deviations
- **Version merge helpers**: Mentioned in TICKET-007 scope but deferred to future ticket (not required for current acceptance criteria - will be implemented when branch merging feature is added)
