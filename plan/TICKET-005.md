# TICKET-005: Basic GraphQL API with NestJS

## Status
- [ ] Completed
- **Commits**:

## Description
Set up the foundational GraphQL API using NestJS with Apollo Server, including schema-first or code-first approach, query/mutation structure, error handling, validation, and integration with Prisma database layer.

## Scope of Work
1. Install and configure GraphQL in NestJS:
   - Apollo Server integration
   - GraphQL module setup
   - Code-first approach using decorators
2. Create base resolvers structure:
   - Query resolvers
   - Mutation resolvers
   - GraphQL Subscription resolvers (for real-time updates)
3. Implement GraphQL context:
   - User authentication context
   - Request scoping
   - DataLoader integration (for N+1 prevention)
4. Set up input validation:
   - DTOs with class-validator
   - Custom validation pipes
   - GraphQL input types
5. Implement error handling:
   - Custom exception filters
   - Formatted error responses
   - Error codes and messages
6. Create GraphQL scalars:
   - DateTime scalar
   - JSON scalar
   - GeoJSON scalar (for spatial data)
   - Upload scalar (for file uploads)
7. Implement file upload support:
   - Configure graphql-upload for multipart requests
   - Create file upload resolvers
   - Integrate with MinIO/S3 for storage
   - File validation (size, type)
   - Generate secure file URLs
8. Set up GraphQL Playground/Apollo Studio for development
9. Configure automatic persisted queries for production
10. Set up Redis-based response caching layer
11. Implement basic queries and mutations:
    - Health check query
    - Basic entity queries (defer complex logic)
    - Settlement and Structure resolvers (queries and mutations)
    - File upload mutation

## Acceptance Criteria
- [ ] GraphQL endpoint is accessible at `/graphql`
- [ ] GraphQL Playground is available in development mode
- [ ] Authentication context is properly set from JWT
- [ ] Input validation returns clear error messages
- [ ] Database queries execute successfully through resolvers
- [ ] DataLoader prevents N+1 query problems
- [ ] Custom scalars (DateTime, JSON, GeoJSON, Upload) work correctly
- [ ] Error handling provides useful debugging information
- [ ] Query complexity limiting is configured
- [ ] Rate limiting is applied to mutations
- [ ] GraphQL subscriptions work for real-time updates
- [ ] Automatic persisted queries work in production
- [ ] Redis caching improves query performance
- [ ] File uploads work via GraphQL
- [ ] Uploaded files are stored in MinIO/S3
- [ ] File size and type validation works
- [ ] Secure file URLs are generated
- [ ] Settlement CRUD operations work via GraphQL
- [ ] Structure CRUD operations work via GraphQL
- [ ] Settlement typed variables serialize correctly
- [ ] Structure typed variables serialize correctly
- [ ] Can query Settlements by Kingdom
- [ ] Can query Structures by Settlement
- [ ] Typed variable validation works for Settlements
- [ ] Typed variable validation works for Structures

## Technical Notes

**Settlement and Structure Considerations:**
- Settlements have typed variables (validated via JSON schema)
- Structures have typed variables and type field (temple, barracks, market, etc.)
- DataLoader pattern prevents N+1 queries when loading Structures for Settlements
- GraphQL JSON scalar handles variableSchemas and variables fields

### Code-First vs Schema-First
**Recommendation: Code-First**
- Better TypeScript integration
- Type safety between code and schema
- Easier refactoring
- Auto-generated SDL

### Base Schema Structure
```typescript
// Example code-first resolver
@Resolver(() => World)
export class WorldResolver {
  constructor(private worldService: WorldService) {}

  @Query(() => World, { nullable: true })
  async world(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<World | null> {
    return this.worldService.findById(id, user);
  }

  @Mutation(() => World)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createWorld(
    @Args('input') input: CreateWorldInput,
    @CurrentUser() user: User,
  ): Promise<World> {
    return this.worldService.create(input, user);
  }
}
```

### Settlement and Structure Resolvers
```typescript
// Settlement resolver example
@Resolver(() => Settlement)
export class SettlementResolver {
  constructor(
    private settlementService: SettlementService,
    private structureLoader: StructureDataLoader,
  ) {}

  @Query(() => Settlement, { nullable: true })
  async settlement(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<Settlement | null> {
    return this.settlementService.findById(id, user);
  }

  @Query(() => [Settlement])
  async settlementsByKingdom(
    @Args('kingdomId', { type: () => ID }) kingdomId: string,
    @CurrentUser() user: User,
  ): Promise<Settlement[]> {
    return this.settlementService.findByKingdom(kingdomId, user);
  }

  @Mutation(() => Settlement)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createSettlement(
    @Args('input') input: CreateSettlementInput,
    @CurrentUser() user: User,
  ): Promise<Settlement> {
    return this.settlementService.create(input, user);
  }

  // Field resolver for nested structures with DataLoader
  @ResolveField(() => [Structure])
  async structures(@Parent() settlement: Settlement): Promise<Structure[]> {
    return this.structureLoader.loadBySettlement(settlement.id);
  }
}

// Structure resolver example
@Resolver(() => Structure)
export class StructureResolver {
  constructor(private structureService: StructureService) {}

  @Query(() => [Structure])
  async structuresBySettlement(
    @Args('settlementId', { type: () => ID }) settlementId: string,
    @CurrentUser() user: User,
  ): Promise<Structure[]> {
    return this.structureService.findBySettlement(settlementId, user);
  }

  @Mutation(() => Structure)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'gm')
  async createStructure(
    @Args('input') input: CreateStructureInput,
    @CurrentUser() user: User,
  ): Promise<Structure> {
    // Validates typed variables against schema
    return this.structureService.create(input, user);
  }

  @Mutation(() => Structure)
  async updateStructureVariables(
    @Args('id', { type: () => ID }) id: string,
    @Args('variables', { type: () => GraphQLJSON }) variables: Record<string, unknown>,
    @CurrentUser() user: User,
  ): Promise<Structure> {
    // Type validation happens in service layer
    return this.structureService.updateVariables(id, variables, user);
  }
}
```

### GraphQL Scalars
```typescript
// Custom scalar for GeoJSON
@Scalar('GeoJSON')
export class GeoJSONScalar {
  description = 'GeoJSON geometry object';

  parseValue(value: unknown): GeoJSONGeometry {
    return this.validateGeoJSON(value);
  }

  serialize(value: unknown): GeoJSONGeometry {
    return this.validateGeoJSON(value);
  }

  parseLiteral(ast: ValueNode): GeoJSONGeometry {
    if (ast.kind === Kind.OBJECT) {
      return this.validateGeoJSON(ast);
    }
    throw new Error('GeoJSON must be an object');
  }
}
```

### DataLoader Pattern
```typescript
@Injectable()
export class CampaignDataLoader {
  private readonly batchCampaigns = new DataLoader<string, Campaign>(
    async (ids: readonly string[]) => {
      const campaigns = await this.prisma.campaign.findMany({
        where: { id: { in: [...ids] } },
      });
      return ids.map(id => campaigns.find(c => c.id === id));
    },
  );

  load(id: string): Promise<Campaign> {
    return this.batchCampaigns.load(id);
  }
}
```

### Error Handling
```typescript
export class CampaignNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({
      statusCode: 404,
      error: 'CAMPAIGN_NOT_FOUND',
      message: `Campaign with ID ${id} not found`,
    });
  }
}
```

### Performance Configuration
- Query depth limiting (max 10)
- Query complexity limiting (max 1000)
- Field rate limiting on mutations
- Response caching headers

### File Upload Implementation
```typescript
// Install graphql-upload
// npm install graphql-upload

// Configure in main.ts
import * as graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js';
app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }));

// Scalar definition
import { GraphQLUpload } from 'graphql-upload';

@Scalar('Upload')
export class UploadScalar {
  description = 'File upload scalar';
  parseValue = GraphQLUpload.parseValue;
  serialize = GraphQLUpload.serialize;
  parseLiteral = GraphQLUpload.parseLiteral;
}

// Upload resolver
@Mutation(() => FileUploadResult)
async uploadFile(
  @Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload,
  @CurrentUser() user: User,
): Promise<FileUploadResult> {
  const stream = file.createReadStream();
  const filename = `${Date.now()}-${file.filename}`;

  // Upload to MinIO/S3
  await this.s3Service.upload(filename, stream, file.mimetype);

  // Generate secure URL
  const url = await this.s3Service.getSignedUrl(filename);

  return {
    id: generateId(),
    filename: file.filename,
    url,
    mimetype: file.mimetype,
    size: await this.getFileSize(stream),
  };
}

// File validation
private validateFile(file: FileUpload): void {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new BadRequestException('Invalid file type');
  }

  // Size validation happens during upload
}
```

## Architectural Decisions
- **Code-first approach**: Better TypeScript integration and type safety
- **Apollo Server**: Industry standard, good ecosystem
- **DataLoader**: Prevent N+1 queries for nested resolvers
- **Class-validator**: Consistent validation across REST and GraphQL
- **Custom scalars**: Domain-specific types (GeoJSON, DateTime, Upload)
- **GraphQL Subscriptions**: Use for real-time updates (preferred over separate WebSocket)
- **Persisted queries**: Enabled for production (security and performance)
- **Caching**: Redis-based caching layer (more flexible than Apollo cache, consistent with rest of system)
- **File uploads**: Implemented via graphql-upload (secure, integrated with GraphQL)
- **File storage**: MinIO/S3 for scalability and reliability
- **Batch mutations**: Not needed for MVP (can add later if performance issues arise)

### GraphQL Subscriptions Setup
```typescript
// Use Redis pub/sub for GraphQL subscriptions
@Subscription(() => EntityUpdated)
entityUpdated(@Args('campaignId') campaignId: string) {
  return this.pubSub.asyncIterator(`entity.updated.${campaignId}`);
}

// Publish from mutation
async updateEntity(id: string, input: UpdateInput) {
  const entity = await this.service.update(id, input);
  await this.pubSub.publish(`entity.updated.${entity.campaignId}`, {
    entityUpdated: entity,
  });
  return entity;
}
```

### Redis Caching Strategy
```typescript
// Cache configuration
@CacheKey('campaign')
@CacheTTL(300) // 5 minutes
async campaign(@Args('id') id: string) {
  return this.campaignService.findById(id);
}

// Invalidate on mutation
async updateCampaign(id: string, input: UpdateInput) {
  const result = await this.service.update(id, input);
  await this.cacheManager.del(`campaign:${id}`);
  return result;
}
```

### Persisted Queries
- Use Apollo's automatic persisted queries (APQ)
- Client sends query hash instead of full query string
- Server caches query by hash
- Reduces bandwidth and improves security
- Configure in production only

## Dependencies
- Requires: TICKET-003 (Database schema)
- Requires: TICKET-004 (Auth system for guards)
- Requires: TICKET-002 (Redis for pub/sub and caching)

## Testing Requirements
- [ ] Can query health check endpoint
- [ ] Authentication guard blocks unauthenticated requests
- [ ] Authorization guard enforces role-based access
- [ ] Input validation rejects invalid data
- [ ] DataLoader batches queries correctly
- [ ] Custom scalars serialize/deserialize correctly
- [ ] Error responses have consistent format
- [ ] Query complexity limiting prevents expensive queries
- [ ] Rate limiting throttles excessive requests
- [ ] GraphQL subscriptions receive updates
- [ ] Persisted queries work with hash lookup
- [ ] Redis caching reduces query time
- [ ] Cache invalidation works on mutations
- [ ] File upload mutation accepts files
- [ ] Files are stored in MinIO/S3
- [ ] File validation rejects invalid types/sizes
- [ ] Secure URLs are generated and accessible

## Related Tickets
- Requires: TICKET-003, TICKET-004
- Blocks: TICKET-006, TICKET-018

## Estimated Effort
2-3 days
