# TICKET-006: Entity CRUD Operations

## Status

- [ ] Completed
- **Commits**:

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
