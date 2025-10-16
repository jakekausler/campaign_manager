# TICKET-006: Entity CRUD Operations

## Status

- [ ] Completed
- **Commits**:
  - 8e00f79: feat(api): add entity CRUD infrastructure foundation (Stage 1)
  - 69c4b04: feat(api): implement core entity CRUD services (Stage 2)
  - 430db93: feat(api): implement kingdom management services (Stage 3)
  - 25bc5b0: feat(api): implement location and event services (Stage 4)
  - 10e0810: feat(api): implement GraphQL layer for all entities (Stage 5)

## Implementation Notes

### Stage 1: Foundation (Completed - 8e00f79)

**What was implemented:**

- Added `archivedAt` field to all core entities (World, Campaign, Party, Kingdom, Settlement, Structure, Character, Location, Encounter, Event)
- Created database migration: 20251016035531_add_archived_at_field
- Implemented centralized AuditService for logging all mutations (CREATE, UPDATE, DELETE, ARCHIVE, RESTORE)
- Created cursor-based pagination infrastructure following Relay specification
- Implemented base filter inputs with EntityStatus enum (ACTIVE, ARCHIVED, DELETED, ALL)
- Added pagination utilities for encoding/decoding cursors
- Created IMPLEMENTATION_PLAN.md documenting 6-stage approach

**Code review feedback addressed:**

- Added error handling to audit service to prevent audit failures from breaking main operations
- Fixed cursor pagination utility (replaced getSkipFromCursor with getCursorPaginationParams)
- Updated cursor security documentation to clarify base64 is for serialization, not security

**Tests:**

- AuditService: 6 tests passing
- All type-check passing

**Next steps:** Stage 2 - Implement core services (WorldService, CampaignService, CharacterService)

### Stage 2: Core Services (Completed - 69c4b04)

**What was implemented:**

- WorldService: Full CRUD + archive + cascade delete to Campaigns and Locations
- CampaignService: Full CRUD + archive + complex cascade delete through hierarchy (Events, Encounters, Characters, Parties, Kingdoms→Settlements→Structures, Branches)
- CharacterService: Full CRUD + archive (no cascade per requirements)
- Input types: CreateWorldInput, UpdateWorldInput, CreateCampaignInput, UpdateCampaignInput, CreateCharacterInput, UpdateCharacterInput
- Authorization: Owner/GM permissions for all mutations, proper campaign access checks
- Party relationship handling in CharacterService with disconnect/connect logic

**Tests:**

- WorldService: 11 tests passing (CRUD, cascade delete, archive/restore)
- CampaignService: 20 tests passing (CRUD, complex cascade, authorization, branch creation)
- CharacterService: 22 tests passing (CRUD, party validation, authorization, no cascade)
- Total: 53 tests, all passing ✅

**Code review highlights:**

- Excellent security: proper authorization, input validation, audit logging
- Good performance: efficient queries, proper use of Prisma patterns
- High code quality: clean, maintainable, well-documented, follows NestJS best practices
- Comprehensive test coverage with edge cases
- Added validation decorator to World calendars field for consistency

**Next steps:** Stage 3 - Implement kingdom management services (PartyService, KingdomService, SettlementService, StructureService)

### Stage 3: Kingdom Management Services (Completed - 430db93)

**What was implemented:**

- PartyService: Full CRUD + archive/restore (no cascade per requirements)
- KingdomService: Full CRUD + archive + cascade delete to Settlements→Structures
- SettlementService: Full CRUD + archive + cascade delete to Structures (updated with audit/archive/restore)
- StructureService: Full CRUD + archive (updated with audit/archive/restore)
- Input types: CreatePartyInput, UpdatePartyInput, CreateKingdomInput, UpdateKingdomInput (Settlement/Structure inputs already existed)
- Authorization: Owner/GM permissions for all mutations
- Location validation: Settlements verify location exists in same world and location not already occupied
- DataLoader support in StructureService with proper authorization checks

**Tests:**

- PartyService: 9 tests passing (CRUD, archive/restore, authorization)
- KingdomService: 8 tests passing (CRUD, cascade delete, archive/restore without cascade)
- SettlementService: 8 tests passing (CRUD, location validation, cascade delete)
- StructureService: 10 tests passing (CRUD, DataLoader batch function, authorization)
- Total: 150 tests across 13 suites, all passing ✅

**Code review highlights:**

- Excellent security: proper authorization, input validation, audit logging
- Good performance: efficient cascade operations, proper use of Prisma patterns
- High code quality: clean, maintainable, well-documented
- Comprehensive test coverage including edge cases
- Location validation prevents data integrity issues

**Next steps:** Stage 4 - Implement Location, Encounter, Event, and Link services

### Stage 4: Location and Event Services (Completed - 25bc5b0)

**What was implemented:**

- LocationService: Full CRUD + archive + hierarchical cascade delete
  - Parent-child location relationships with world-scoping validation
  - Circular reference detection to prevent invalid hierarchies
  - Recursive cascade delete through entire location tree
  - Support for removing parent (disconnect relationship)

- EncounterService: Full CRUD + archive (no cascade per requirements)
  - Campaign-scoped with authorization checks (owner/GM permissions)
  - Optional location linking with world validation
  - Resolved state management with auto-set resolvedAt timestamps
  - World-scoping validation ensures locations belong to campaign's world

- EventService: Full CRUD + archive (no cascade per requirements)
  - Campaign-scoped with authorization checks (owner/GM permissions)
  - Event scheduling with scheduledAt and occurredAt timestamps
  - Auto-set occurredAt when marking event as completed
  - Event type categorization (story, kingdom, party, world)

- LinkService: Create and query links between Encounters and Events
  - Typed relationships (prerequisite, blocks, triggers, related)
  - Bidirectional link queries (find by source or target)
  - Duplicate link prevention (same type between same entities)
  - Same-campaign validation for all linked entities
  - Full authorization through entity ownership checks

- Input types: CreateLocationInput, UpdateLocationInput, CreateEncounterInput, UpdateEncounterInput, CreateEventInput, UpdateEventInput, CreateLinkInput, UpdateLinkInput

**Tests:**

- LocationService: 20 tests (hierarchical relationships, cascade delete through multiple levels, circular reference prevention, world validation)
- EncounterService: 16 tests (CRUD, authorization, world validation, resolved state transitions)
- EventService: 17 tests (CRUD, authorization, scheduling, completion state management)
- LinkService: 14 tests (cross-entity linking, duplicate prevention, same-campaign validation)
- Total: 228 tests across 17 suites, all passing ✅

**Code review highlights:**

- Excellent security: Comprehensive authorization checks for campaign-scoped entities
- Smart validation: Circular reference detection, world-scoping, duplicate prevention
- Efficient cascade: Batch operations with recursive depth-first pattern for hierarchies
- Proper Prisma patterns: Relation disconnect/connect for optional relationships
- Type safety: Full TypeScript strict mode compliance, no `any` types
- Clean architecture: Consistent patterns with Stages 1-3, DRY principles followed
- Comprehensive tests: 67 new tests covering happy paths, errors, edge cases

**Technical details:**

- Hierarchical cascade delete uses recursive pattern with batch updates per level
- Location parent updates validate against circular references before committing
- Event completion auto-sets occurredAt only if not already set
- Encounter/Event location updates use Prisma disconnect/connect patterns
- Link service validates both entities exist and belong to same campaign
- All services follow identical authorization pattern from previous stages

**Next steps:** Stage 6 - Final testing and documentation

### Stage 5: GraphQL Layer (Completed - 10e0810)

**What was implemented:**

- GraphQL types for all 11 core entities:
  - World, Campaign, Character, Party, Kingdom
  - Settlement, Structure (added archivedAt field)
  - Location, Encounter, Event, Link

- Resolvers with full CRUD operations:
  - Query resolvers: Get by ID, list by parent entity
  - Mutation resolvers: Create, Update, Delete (soft), Archive, Restore
  - Authorization guards: JWT authentication + owner/GM roles
  - Input validation: class-validator decorators on all inputs

- Service layer enhancements:
  - Added findByWorldId() to CampaignService
  - Added findByPartyId() to CharacterService
  - Added findByCampaignId() and findByLocationId() to EncounterService and EventService
  - Added findBySourceEntity() and findByTargetEntity() to LinkService
  - Added findByParentId() to LocationService
  - World and Location services handle global/world-scoped access

- Input validation improvements:
  - Added @IsIn validator for event types ('story', 'kingdom', 'party', 'world')
  - All inputs use comprehensive class-validator decorators
  - UUID validation for all entity references

- GraphQL module:
  - Wired up all 11 resolvers and services
  - Maintained consistent provider organization
  - All scalars and context properly configured

**Tests:**

- 228 tests passing (17 test suites, all tests green)
- Type-check and lint clean
- Code review approved

**Code review highlights:**

- Excellent security: Comprehensive authorization checks, input validation, audit logging
- Clean architecture: Clear separation between resolvers, services, and data access
- Type safety: Full TypeScript strict mode compliance
- Consistent patterns: All resolvers follow identical patterns for CRUD + archive/restore
- Performance: Services use efficient queries with proper authorization checks
- DRY principles: Link service uses helper methods to avoid code duplication

**Next steps:** Stage 6 - Final testing and documentation

## Description

Implement complete CRUD (Create, Read, Update, Delete) operations for all core domain entities through GraphQL API, with proper validation, error handling, and relationship management.

## Scope of Work

1. Create services for each entity type:
   - WorldService
   - CampaignService
   - CharacterService
   - PartyService
   - KingdomService
   - SettlementService
   - StructureService
   - LocationService (basic, without geometry yet)
   - EncounterService
   - EventService
   - LinkService
2. Implement GraphQL resolvers with operations:
   - Queries: `entity(id)`, `entities(filter, pagination)`
   - Mutations: `createEntity`, `updateEntity`, `deleteEntity`, `archiveEntity`, `restoreEntity`
   - Field resolvers for relationships
3. Create input DTOs with validation:
   - CreateEntityInput types
   - UpdateEntityInput types
   - FilterInput types for search
   - PaginationInput types
4. Implement soft delete pattern (all deletes are soft, no hard deletes):
   - Set `deletedAt` timestamp on delete
   - Cascade soft delete to orphaned children
   - Create audit entries for all deletions
5. Implement archive functionality (separate from delete):
   - Add `archivedAt` timestamp field
   - Archive mutations for each entity type
   - Archived entities hidden from default queries but not deleted
   - Can restore archived entities
6. Add cascade delete logic:
   - When parent deleted, soft delete orphaned children
   - Example: deleting a Campaign soft deletes all its Events/Encounters/etc.
   - Configurable cascade rules per relationship type
7. Add search and filtering capabilities:
   - Text search on name/description
   - Filter by tags, type, parent entity
   - Filter by status (active, archived, deleted)
   - Sort by created date, updated date, name
8. Implement pagination (cursor-based recommended for GraphQL)
9. Create link management between entities:
   - Link Location ↔ Encounter
   - Link Character ↔ Event
   - Link Event ↔ Location
10. Add validation rules:
    - Required fields validation
    - Business logic validation
    - Permission checks (owner/GM only for mutations)
    - No duplicate name prevention (allow duplicates)

## Acceptance Criteria

- [ ] Can create all entity types via GraphQL mutations
- [ ] Can query single entities by ID
- [ ] Can query lists of entities with filters
- [ ] Can update entity fields
- [ ] Can delete entities (soft delete only, no hard deletes)
- [ ] Can archive entities (separate from delete)
- [ ] Can restore archived entities
- [ ] Deleting parent cascades soft delete to orphaned children
- [ ] All deletions create audit entries
- [ ] Pagination works correctly for large result sets
- [ ] Relationships are properly loaded (nested queries work)
- [ ] Input validation prevents invalid data
- [ ] Authorization prevents unauthorized mutations
- [ ] Links between entities can be created and queried
- [ ] Search functionality returns relevant results
- [ ] Can filter by status (active, archived, deleted)
- [ ] Duplicate names are allowed
- [ ] Errors provide clear messages for debugging

## Technical Notes

### Pagination Pattern

```typescript
interface PaginatedResponse<T> {
  edges: Array<{
    cursor: string;
    node: T;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
    endCursor: string;
  };
  totalCount: number;
}

@Query(() => PaginatedCampaigns)
async campaigns(
  @Args('first', { nullable: true }) first: number = 20,
  @Args('after', { nullable: true }) after: string,
  @Args('filter', { nullable: true }) filter: CampaignFilter,
): Promise<PaginatedCampaigns> {
  return this.campaignService.findMany({ first, after, filter });
}
```

### Input Validation Example

```typescript
@InputType()
class CreateCampaignInput {
  @Field()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @Field()
  @IsUUID()
  worldId: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  settings?: Record<string, unknown>;
}
```

### Service Layer Pattern

```typescript
@Injectable()
export class CampaignService {
  constructor(
    private prisma: PrismaService,
    private authz: AuthorizationService,
    private audit: AuditService
  ) {}

  async create(input: CreateCampaignInput, user: User): Promise<Campaign> {
    // Validate world exists
    await this.validateWorldExists(input.worldId);

    // Create campaign
    const campaign = await this.prisma.campaign.create({
      data: {
        ...input,
        ownerId: user.id,
      },
    });

    // Create audit entry
    await this.audit.log('campaign', campaign.id, 'CREATE', user.id, input);

    // Create default branch
    await this.createDefaultBranch(campaign.id);

    return campaign;
  }

  async findById(id: string, user: User): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id, deletedAt: null }, // Exclude soft deleted
      include: { world: true, branches: true },
    });

    if (!campaign) {
      throw new CampaignNotFoundException(id);
    }

    // Check permissions
    await this.authz.requireCampaignAccess(campaign.id, user);

    return campaign;
  }

  async softDelete(id: string, user: User): Promise<Campaign> {
    const campaign = await this.findById(id, user);

    // Soft delete campaign
    const deleted = await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Cascade delete to orphaned children
    await this.cascadeDelete(id, user);

    // Create audit entry
    await this.audit.log('campaign', id, 'DELETE', user.id, { deletedAt: deleted.deletedAt });

    return deleted;
  }

  async archive(id: string, user: User): Promise<Campaign> {
    const campaign = await this.findById(id, user);

    const archived = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.audit.log('campaign', id, 'ARCHIVE', user.id, { archivedAt: archived.archivedAt });

    return archived;
  }

  async restore(id: string, user: User): Promise<Campaign> {
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { archivedAt: null },
    });

    await this.audit.log('campaign', id, 'RESTORE', user.id, { archivedAt: null });

    return campaign;
  }

  private async cascadeDelete(campaignId: string, user: User): Promise<void> {
    // Soft delete all orphaned children
    await this.prisma.event.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await this.prisma.encounter.updateMany({
      where: { campaignId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    // ... other child entities
  }
}
```

### Link Management

```typescript
@Mutation(() => Link)
async createLink(
  @Args('input') input: CreateLinkInput,
  @CurrentUser() user: User,
): Promise<Link> {
  // Validate both entities exist and user has access
  await this.validateEntities(input.fromEntity, input.toEntity, user);

  return this.linkService.create(input);
}
```

## Architectural Decisions

- **Soft delete only**: ALL deletes are soft (set `deletedAt`), no hard deletes ever
- **Cascade delete**: Deleting parent soft deletes orphaned children
- **Archive separate from delete**: `archivedAt` field for hiding without deleting
- **Audit all mutations**: Every CREATE/UPDATE/DELETE/ARCHIVE/RESTORE logged
- **No duplicate prevention**: Duplicate names are allowed
- **No bulk operations**: Not needed for MVP, add later if needed
- **Cursor pagination**: Better for GraphQL, handles additions/deletions
- **Service layer**: Business logic in services, resolvers are thin
- **Eager vs lazy loading**: Use DataLoader for relationships to avoid N+1

### Cascade Rules

| Parent Entity | Cascade Behavior                                                       |
| ------------- | ---------------------------------------------------------------------- |
| World         | Cascade to Campaigns, Locations                                        |
| Campaign      | Cascade to Events, Encounters, Characters, Parties, Kingdoms, Branches |
| Kingdom       | Cascade to Settlements                                                 |
| Settlement    | Cascade to Structures                                                  |
| Location      | Cascade to child Locations (hierarchy)                                 |
| Event         | Do not cascade (keep audit trail)                                      |
| Encounter     | Do not cascade (keep audit trail)                                      |

### Archive vs Delete

- **Archive**: Temporary hiding, can be restored easily, used for "inactive" content
- **Delete**: Permanent removal (soft), used for actual deletion, creates audit trail
- Archived entities: `archivedAt IS NOT NULL AND deletedAt IS NULL`
- Deleted entities: `deletedAt IS NOT NULL`
- Active entities: `archivedAt IS NULL AND deletedAt IS NULL`

## Dependencies

- Requires: TICKET-005 (GraphQL API foundation)
- Requires: TICKET-003 (Database schema with deletedAt/archivedAt fields)

## Testing Requirements

- [ ] Create entity with valid data succeeds
- [ ] Create entity with invalid data fails with validation error
- [ ] Update entity modifies fields correctly
- [ ] Delete entity marks as deleted (soft delete only)
- [ ] Archive entity marks as archived
- [ ] Restore entity clears archivedAt
- [ ] Cascade delete works (deleting parent deletes children)
- [ ] Audit entries created for all mutations
- [ ] Deleted entities don't appear in default list queries
- [ ] Archived entities don't appear in default list queries
- [ ] Can filter to show deleted/archived entities
- [ ] Duplicate names are allowed
- [ ] Pagination returns correct page of results
- [ ] Filtering returns matching entities only
- [ ] Unauthorized users cannot mutate entities
- [ ] Creating links between entities works
- [ ] Querying nested relationships doesn't cause N+1 queries

## Related Tickets

- Requires: TICKET-003, TICKET-005
- Blocks: TICKET-007, TICKET-009, TICKET-010, TICKET-013, TICKET-023

## Estimated Effort

4-5 days
