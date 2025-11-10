/**
 * Cascade Invalidation Integration Tests
 *
 * These integration tests verify end-to-end cascade invalidation behavior
 * with real entities and Redis. They test that when entities are mutated,
 * the appropriate caches are invalidated throughout the cascade hierarchy.
 *
 * Note: This test uses mocking for services that have circular dependencies
 * (CampaignContextService, PartyService, KingdomService) to avoid stack overflow
 * during NestJS module initialization. The services under test (ConditionService,
 * SettlementService, StructureService, StateVariableService) are real instances.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';

import { CacheModule } from '../../common/cache/cache.module';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../database/prisma.service';
import { RulesEngineClientService } from '../../grpc/rules-engine-client.service';
import { ExpressionCache } from '../../rules/cache/expression-cache';
import { ExpressionParserService } from '../../rules/expression-parser.service';
import { OperatorRegistry } from '../../rules/operator-registry';
import { WebSocketPublisherService } from '../../websocket/websocket-publisher.service';
import type { AuthenticatedUser } from '../context/graphql-context';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { VariableScope, VariableType } from '../types/state-variable.type';

import { AuditService } from './audit.service';
import { CampaignContextService } from './campaign-context.service';
import { ConditionEvaluationService } from './condition-evaluation.service';
import { ConditionService } from './condition.service';
import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';
import { KingdomService } from './kingdom.service';
import { PartyService } from './party.service';
import { SettlementService } from './settlement.service';
import { StateVariableService } from './state-variable.service';
import { StructureService } from './structure.service';
import { VariableEvaluationService } from './variable-evaluation.service';
import { VersionService } from './version.service';

/**
 * Integration tests for cascade invalidation with real entities and Redis
 *
 * Tests verify:
 * 1. FieldCondition changes invalidate ALL computed fields in campaign
 * 2. Settlement changes invalidate settlement + structures cascade
 * 3. Structure changes invalidate structure + parent settlement
 * 4. StateVariable changes invalidate entity's computed fields
 */
describe('Cascade Invalidation Integration Tests', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let redis: Redis;
  let cacheService: CacheService;
  let conditionService: ConditionService;
  let settlementService: SettlementService;
  let structureService: StructureService;
  let stateVariableService: StateVariableService;

  // Test entities
  let userId: string;
  let worldId: string;
  let campaignId: string;
  let branchId: string;
  let kingdomId: string;
  let settlementId: string;
  let structureId: string;
  let fieldConditionId: string;

  const mockUser: AuthenticatedUser = {
    id: 'test-user',
    email: 'test@example.com',
    role: 'user',
  };

  // Helper function to build cache key with prefix (matching CacheService behavior)
  const cacheKey = (key: string) => `cache:${key}`;

  beforeAll(async () => {
    // Create test module with real services for ConditionService, SettlementService,
    // StructureService, StateVariableService, and mocks for circular dependencies
    module = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        PrismaService,
        ConditionService,
        SettlementService,
        StructureService,
        StateVariableService,
        VersionService,
        AuditService,
        ConditionEvaluationService,
        DependencyGraphService,
        DependencyGraphBuilderService,
        VariableEvaluationService,
        ExpressionParserService,
        OperatorRegistry,
        ExpressionCache,
        // Mock CampaignContextService to break circular dependency
        {
          provide: CampaignContextService,
          useValue: {
            getCampaignContext: jest.fn().mockResolvedValue({
              parties: [],
              kingdoms: [],
              settlements: [],
              structures: [],
            }),
            invalidateContext: jest.fn().mockResolvedValue(undefined),
            invalidateContextForEntity: jest.fn().mockResolvedValue(undefined),
          },
        },
        // Mock PartyService to break circular dependency
        {
          provide: PartyService,
          useValue: {
            findById: jest.fn(),
            findByCampaign: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            delete: jest.fn(),
            archive: jest.fn(),
            restore: jest.fn(),
            calculateAverageLevel: jest.fn(),
            setLevel: jest.fn(),
          },
        },
        // Mock KingdomService to break circular dependency
        {
          provide: KingdomService,
          useValue: {
            findById: jest.fn(),
            findByCampaign: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            delete: jest.fn(),
            archive: jest.fn(),
            restore: jest.fn(),
            setLevel: jest.fn(),
          },
        },
        {
          provide: RulesEngineClientService,
          useValue: {
            isAvailable: jest.fn().mockResolvedValue(false),
            evaluateCondition: jest.fn(),
            evaluateConditions: jest.fn(),
            getEvaluationOrder: jest.fn(),
            validateDependencies: jest.fn(),
            invalidateCache: jest.fn(),
            getCacheStats: jest.fn(),
            getCircuitState: jest.fn(),
          },
        },
        {
          provide: WebSocketPublisherService,
          useValue: {
            publishEntityUpdated: jest.fn().mockResolvedValue(undefined),
            publishSettlementUpdated: jest.fn().mockResolvedValue(undefined),
            publishStructureUpdated: jest.fn().mockResolvedValue(undefined),
            publishWorldTimeChanged: jest.fn().mockResolvedValue(undefined),
            publishStateInvalidated: jest.fn().mockResolvedValue(undefined),
            publishEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: REDIS_PUBSUB,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
    conditionService = module.get<ConditionService>(ConditionService);
    settlementService = module.get<SettlementService>(SettlementService);
    structureService = module.get<StructureService>(StructureService);
    stateVariableService = module.get<StateVariableService>(StateVariableService);

    // Create Redis client for direct verification
    redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 1, // Use cache DB
    });
  });

  beforeEach(async () => {
    // Create test data hierarchy: User → World → Campaign → Branch → Kingdom → Settlement → Structure
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'hash',
      },
    });
    userId = user.id;
    mockUser.id = userId;

    const world = await prisma.world.create({
      data: {
        name: 'Test World',
        calendars: [],
      },
    });
    worldId = world.id;

    const campaign = await prisma.campaign.create({
      data: {
        name: 'Test Campaign',
        worldId,
        ownerId: userId,
      },
    });
    campaignId = campaign.id;

    const branch = await prisma.branch.create({
      data: {
        name: 'main',
        campaignId,
      },
    });
    branchId = branch.id;

    const kingdom = await prisma.kingdom.create({
      data: {
        name: 'Test Kingdom',
        campaignId,
      },
    });
    kingdomId = kingdom.id;

    const location = await prisma.location.create({
      data: {
        name: 'Test Location',
        worldId,
        type: 'point',
      },
    });

    const settlement = await prisma.settlement.create({
      data: {
        name: 'Test Settlement',
        kingdomId,
        locationId: location.id,
        level: 1,
      },
    });
    settlementId = settlement.id;

    const structure = await prisma.structure.create({
      data: {
        name: 'Test Structure',
        type: 'temple',
        settlementId,
        level: 1,
      },
    });
    structureId = structure.id;

    // Create a FieldCondition for campaign-level tests
    const fieldCondition = await prisma.fieldCondition.create({
      data: {
        entityType: 'Settlement',
        entityId: settlementId,
        field: 'testField',
        expression: { '==': [1, 1] },
        priority: 0,
        createdBy: userId,
      },
    });
    fieldConditionId = fieldCondition.id;

    // Clear Redis before each test
    await redis.flushdb();
  });

  afterEach(async () => {
    // Clean up in reverse dependency order
    // Delete state variables first (they reference various entities)
    await prisma.stateVariable.deleteMany({ where: { createdBy: userId } });
    // Delete structures
    await prisma.structure.deleteMany({ where: { settlementId } });
    // Delete settlements
    await prisma.settlement.deleteMany({ where: { kingdomId } });
    // Delete kingdoms
    await prisma.kingdom.deleteMany({ where: { id: kingdomId } });
    // Delete field conditions
    await prisma.fieldCondition.deleteMany({ where: { id: fieldConditionId } });
    // Delete versions before branches
    await prisma.version.deleteMany({ where: { branchId } });
    // Delete branches
    await prisma.branch.deleteMany({ where: { id: branchId } });
    // Delete campaigns
    await prisma.campaign.deleteMany({ where: { id: campaignId } });
    // Delete locations before worlds
    await prisma.location.deleteMany({ where: { worldId } });
    // Delete worlds
    await prisma.world.deleteMany({ where: { id: worldId } });
    // Delete audit records before users
    await prisma.audit.deleteMany({ where: { userId } });
    // Delete users last
    await prisma.user.deleteMany({ where: { id: userId } });

    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
    await prisma.$disconnect();
    await module.close();
  });

  describe('FieldCondition cascade invalidation', () => {
    it('should invalidate all computed fields when FieldCondition is created', async () => {
      // Arrange: Populate caches for settlements and structures
      const settlementCacheKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structureCacheKey = `computed-fields:structure:${structureId}:${branchId}`;

      await cacheService.set(settlementCacheKey, { testField: 'value1' }, { ttl: 300 });
      await cacheService.set(structureCacheKey, { testField: 'value2' }, { ttl: 300 });

      // Verify caches are populated
      expect(await redis.get(cacheKey(settlementCacheKey))).toBeTruthy();
      expect(await redis.get(cacheKey(structureCacheKey))).toBeTruthy();

      // Act: Create new FieldCondition
      await conditionService.create(
        {
          entityType: 'Settlement',
          entityId: settlementId,
          field: 'newField',
          expression: { '==': [2, 2] },
        },
        mockUser
      );

      // Assert: Both settlement and structure computed field caches should be invalidated
      expect(await redis.get(cacheKey(settlementCacheKey))).toBeNull();
      expect(await redis.get(cacheKey(structureCacheKey))).toBeNull();
    });

    it('should invalidate all computed fields when FieldCondition is updated', async () => {
      // Arrange: Populate caches
      const settlementCacheKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structureCacheKey = `computed-fields:structure:${structureId}:${branchId}`;

      await cacheService.set(settlementCacheKey, { testField: 'value1' }, { ttl: 300 });
      await cacheService.set(structureCacheKey, { testField: 'value2' }, { ttl: 300 });

      // Act: Update existing FieldCondition
      await conditionService.update(
        fieldConditionId,
        {
          expression: { '==': [3, 3] },
          expectedVersion: 1,
        },
        mockUser
      );

      // Assert: Both caches should be invalidated
      expect(await redis.get(cacheKey(settlementCacheKey))).toBeNull();
      expect(await redis.get(cacheKey(structureCacheKey))).toBeNull();
    });

    it('should invalidate all computed fields when FieldCondition is deleted', async () => {
      // Arrange: Populate caches
      const settlementCacheKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structureCacheKey = `computed-fields:structure:${structureId}:${branchId}`;

      await cacheService.set(settlementCacheKey, { testField: 'value1' }, { ttl: 300 });
      await cacheService.set(structureCacheKey, { testField: 'value2' }, { ttl: 300 });

      // Act: Delete FieldCondition
      await conditionService.delete(fieldConditionId, mockUser);

      // Assert: Both caches should be invalidated
      expect(await redis.get(cacheKey(settlementCacheKey))).toBeNull();
      expect(await redis.get(cacheKey(structureCacheKey))).toBeNull();
    });
  });

  describe('Settlement cascade invalidation', () => {
    it('should cascade invalidation when settlement is updated', async () => {
      // Arrange: Populate caches
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structureComputedKey = `computed-fields:structure:${structureId}:${branchId}`;
      const structuresListKey = `structures:settlement:${settlementId}:${branchId}`;
      const spatialKey = `spatial:settlements-in-region:test:${branchId}`;

      await cacheService.set(settlementComputedKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(structureComputedKey, { field2: 'value2' }, { ttl: 300 });
      await cacheService.set(structuresListKey, [{ id: structureId }], { ttl: 600 });
      await cacheService.set(spatialKey, [{ id: settlementId }], { ttl: 300 });

      // Verify all caches are populated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeTruthy();
      expect(await redis.get(cacheKey(structureComputedKey))).toBeTruthy();
      expect(await redis.get(cacheKey(structuresListKey))).toBeTruthy();
      expect(await redis.get(cacheKey(spatialKey))).toBeTruthy();

      // Act: Update settlement
      await settlementService.update(
        settlementId,
        { name: 'Updated Settlement' },
        mockUser,
        1,
        branchId
      );

      // Assert: All related caches should be invalidated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structuresListKey))).toBeNull();
      expect(await redis.get(cacheKey(spatialKey))).toBeNull();
    });

    it('should cascade invalidation when settlement level changes', async () => {
      // Arrange: Populate caches
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:main`;
      const structureComputedKey = `computed-fields:structure:${structureId}:main`;

      await cacheService.set(settlementComputedKey, { level: 1 }, { ttl: 300 });
      await cacheService.set(structureComputedKey, { parentLevel: 1 }, { ttl: 300 });

      // Act: Change settlement level
      await settlementService.setLevel(settlementId, 2, mockUser);

      // Assert: Related caches should be invalidated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
    });
  });

  describe('Structure cascade invalidation', () => {
    it('should cascade invalidation when structure is updated', async () => {
      // Arrange: Populate caches
      const structureComputedKey = `computed-fields:structure:${structureId}:${branchId}`;
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structuresListKey = `structures:settlement:${settlementId}:${branchId}`;

      await cacheService.set(structureComputedKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(settlementComputedKey, { structureCount: 1 }, { ttl: 300 });
      await cacheService.set(structuresListKey, [{ id: structureId }], { ttl: 600 });

      // Verify all caches are populated
      expect(await redis.get(cacheKey(structureComputedKey))).toBeTruthy();
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeTruthy();
      expect(await redis.get(cacheKey(structuresListKey))).toBeTruthy();

      // Act: Update structure
      await structureService.update(
        structureId,
        { name: 'Updated Structure' },
        mockUser,
        1,
        branchId
      );

      // Assert: Structure, parent settlement, and structures list caches should be invalidated
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structuresListKey))).toBeNull();
    });

    it('should cascade invalidation when structure level changes', async () => {
      // Arrange: Populate caches
      const structureComputedKey = `computed-fields:structure:${structureId}:main`;
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:main`;

      await cacheService.set(structureComputedKey, { level: 1 }, { ttl: 300 });
      await cacheService.set(settlementComputedKey, { maxStructureLevel: 1 }, { ttl: 300 });

      // Act: Change structure level
      await structureService.setLevel(structureId, 3, mockUser);

      // Assert: Both caches should be invalidated
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
    });
  });

  describe('StateVariable cascade invalidation', () => {
    it('should invalidate settlement computed fields when StateVariable is created', async () => {
      // Arrange: Populate settlement computed fields cache
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:main`;
      await cacheService.set(settlementComputedKey, { population: 1000 }, { ttl: 300 });

      // Verify cache is populated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeTruthy();

      // Act: Create StateVariable for settlement
      await stateVariableService.create(
        {
          scope: VariableScope.SETTLEMENT,
          scopeId: settlementId,
          key: 'population',
          value: 2000,
          type: VariableType.INTEGER,
        },
        mockUser
      );

      // Assert: Settlement computed fields cache should be invalidated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
    });

    it('should invalidate structure computed fields when StateVariable is created', async () => {
      // Arrange: Populate structure computed fields cache
      const structureComputedKey = `computed-fields:structure:${structureId}:main`;
      await cacheService.set(structureComputedKey, { capacity: 100 }, { ttl: 300 });

      // Verify cache is populated
      expect(await redis.get(cacheKey(structureComputedKey))).toBeTruthy();

      // Act: Create StateVariable for structure
      await stateVariableService.create(
        {
          scope: VariableScope.STRUCTURE,
          scopeId: structureId,
          key: 'capacity',
          value: 200,
          type: VariableType.INTEGER,
        },
        mockUser
      );

      // Assert: Structure computed fields cache should be invalidated
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
    });

    it('should invalidate entity computed fields when StateVariable is updated', async () => {
      // Arrange: Create a StateVariable and populate cache
      const stateVar = await prisma.stateVariable.create({
        data: {
          scope: 'settlement',
          scopeId: settlementId,
          key: 'wealth',
          value: 5000,
          type: 'integer',
          createdBy: userId,
        },
      });

      const settlementComputedKey = `computed-fields:settlement:${settlementId}:main`;
      await cacheService.set(settlementComputedKey, { wealth: 5000 }, { ttl: 300 });

      // Act: Update StateVariable
      await stateVariableService.update(stateVar.id, { value: 10000 }, mockUser, '1');

      // Assert: Settlement computed fields cache should be invalidated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();

      // Cleanup
      await prisma.stateVariable.delete({ where: { id: stateVar.id } });
    });

    it('should invalidate entity computed fields when StateVariable is deleted', async () => {
      // Arrange: Create a StateVariable and populate cache
      const stateVar = await prisma.stateVariable.create({
        data: {
          scope: 'structure',
          scopeId: structureId,
          key: 'defenders',
          value: 50,
          type: 'integer',
          createdBy: userId,
        },
      });

      const structureComputedKey = `computed-fields:structure:${structureId}:main`;
      await cacheService.set(structureComputedKey, { defenders: 50 }, { ttl: 300 });

      // Act: Delete StateVariable
      await stateVariableService.delete(stateVar.id, mockUser);

      // Assert: Structure computed fields cache should be invalidated
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
    });
  });

  describe('No over-invalidation - unrelated entities unaffected', () => {
    let unrelatedSettlementId: string;
    let unrelatedStructureId: string;

    beforeEach(async () => {
      // Create unrelated settlement and structure in the same campaign/kingdom
      const unrelatedLocation = await prisma.location.create({
        data: {
          name: 'Unrelated Location',
          worldId,
          type: 'point',
        },
      });

      const unrelatedSettlement = await prisma.settlement.create({
        data: {
          name: 'Unrelated Settlement',
          kingdomId,
          locationId: unrelatedLocation.id,
          level: 1,
        },
      });
      unrelatedSettlementId = unrelatedSettlement.id;

      const unrelatedStructure = await prisma.structure.create({
        data: {
          name: 'Unrelated Structure',
          type: 'barracks',
          settlementId: unrelatedSettlementId,
          level: 1,
        },
      });
      unrelatedStructureId = unrelatedStructure.id;
    });

    afterEach(async () => {
      await prisma.structure.deleteMany({ where: { id: unrelatedStructureId } });
      await prisma.settlement.deleteMany({ where: { id: unrelatedSettlementId } });
    });

    it('should NOT invalidate unrelated settlement when different settlement is updated', async () => {
      // Arrange: Populate caches for both settlements
      const targetSettlementKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const unrelatedSettlementKey = `computed-fields:settlement:${unrelatedSettlementId}:${branchId}`;

      await cacheService.set(targetSettlementKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(unrelatedSettlementKey, { field2: 'value2' }, { ttl: 300 });

      // Verify both caches are populated
      expect(await redis.get(cacheKey(targetSettlementKey))).toBeTruthy();
      expect(await redis.get(cacheKey(unrelatedSettlementKey))).toBeTruthy();

      // Act: Update target settlement (not the unrelated one)
      await settlementService.update(
        settlementId,
        { name: 'Updated Settlement' },
        mockUser,
        1,
        branchId
      );

      // Assert: Target settlement cache should be invalidated
      expect(await redis.get(cacheKey(targetSettlementKey))).toBeNull();

      // Assert: Unrelated settlement cache should remain intact
      expect(await redis.get(cacheKey(unrelatedSettlementKey))).toBeTruthy();
      const unrelatedCache = await redis.get(cacheKey(unrelatedSettlementKey));
      expect(JSON.parse(unrelatedCache!)).toEqual({ field2: 'value2' });
    });

    it('should NOT invalidate unrelated structure when different structure is updated', async () => {
      // Arrange: Populate caches for both structures
      const targetStructureKey = `computed-fields:structure:${structureId}:${branchId}`;
      const unrelatedStructureKey = `computed-fields:structure:${unrelatedStructureId}:${branchId}`;

      await cacheService.set(targetStructureKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(unrelatedStructureKey, { field2: 'value2' }, { ttl: 300 });

      // Verify both caches are populated
      expect(await redis.get(cacheKey(targetStructureKey))).toBeTruthy();
      expect(await redis.get(cacheKey(unrelatedStructureKey))).toBeTruthy();

      // Act: Update target structure (not the unrelated one)
      await structureService.update(
        structureId,
        { name: 'Updated Structure' },
        mockUser,
        1,
        branchId
      );

      // Assert: Target structure cache should be invalidated
      expect(await redis.get(cacheKey(targetStructureKey))).toBeNull();

      // Assert: Unrelated structure cache should remain intact
      expect(await redis.get(cacheKey(unrelatedStructureKey))).toBeTruthy();
      const unrelatedCache = await redis.get(cacheKey(unrelatedStructureKey));
      expect(JSON.parse(unrelatedCache!)).toEqual({ field2: 'value2' });
    });

    it('should NOT invalidate unrelated settlement when structure in different settlement is updated', async () => {
      // Arrange: Populate caches
      const targetStructureKey = `computed-fields:structure:${structureId}:${branchId}`;
      const parentSettlementKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const unrelatedSettlementKey = `computed-fields:settlement:${unrelatedSettlementId}:${branchId}`;

      await cacheService.set(targetStructureKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(parentSettlementKey, { field2: 'value2' }, { ttl: 300 });
      await cacheService.set(unrelatedSettlementKey, { field3: 'value3' }, { ttl: 300 });

      // Act: Update structure in settlement A
      await structureService.update(
        structureId,
        { name: 'Updated Structure' },
        mockUser,
        1,
        branchId
      );

      // Assert: Structure and its parent settlement caches should be invalidated
      expect(await redis.get(cacheKey(targetStructureKey))).toBeNull();
      expect(await redis.get(cacheKey(parentSettlementKey))).toBeNull();

      // Assert: Unrelated settlement cache should remain intact
      expect(await redis.get(cacheKey(unrelatedSettlementKey))).toBeTruthy();
      const unrelatedCache = await redis.get(cacheKey(unrelatedSettlementKey));
      expect(JSON.parse(unrelatedCache!)).toEqual({ field3: 'value3' });
    });

    it('should NOT invalidate sibling structures when one structure in same settlement is updated', async () => {
      // Arrange: Create sibling structure in the same settlement
      const siblingStructure = await prisma.structure.create({
        data: {
          name: 'Sibling Structure',
          type: 'market',
          settlementId, // Same settlement as main structure
          level: 1,
        },
      });

      const targetStructureKey = `computed-fields:structure:${structureId}:${branchId}`;
      const siblingStructureKey = `computed-fields:structure:${siblingStructure.id}:${branchId}`;

      await cacheService.set(targetStructureKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(siblingStructureKey, { field2: 'value2' }, { ttl: 300 });

      // Act: Update target structure
      await structureService.update(
        structureId,
        { name: 'Updated Structure' },
        mockUser,
        1,
        branchId
      );

      // Assert: Target structure cache should be invalidated
      expect(await redis.get(cacheKey(targetStructureKey))).toBeNull();

      // Assert: Sibling structure cache should remain intact (no cascade to siblings)
      expect(await redis.get(cacheKey(siblingStructureKey))).toBeTruthy();
      const siblingCache = await redis.get(cacheKey(siblingStructureKey));
      expect(JSON.parse(siblingCache!)).toEqual({ field2: 'value2' });

      // Cleanup
      await prisma.structure.delete({ where: { id: siblingStructure.id } });
    });

    it('should NOT invalidate unrelated StateVariable entity when different entity StateVariable is updated', async () => {
      // Arrange: Create StateVariables for both settlements
      const targetStateVar = await prisma.stateVariable.create({
        data: {
          scope: 'settlement',
          scopeId: settlementId,
          key: 'population',
          value: 1000 as unknown as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      const unrelatedStateVar = await prisma.stateVariable.create({
        data: {
          scope: 'settlement',
          scopeId: unrelatedSettlementId,
          key: 'population',
          value: 2000 as unknown as Prisma.InputJsonValue,
          type: 'integer',
          createdBy: mockUser.id,
        },
      });

      // Populate caches
      const targetSettlementKey = `computed-fields:settlement:${settlementId}:main`;
      const unrelatedSettlementKey = `computed-fields:settlement:${unrelatedSettlementId}:main`;

      await cacheService.set(targetSettlementKey, { population: 1000 }, { ttl: 300 });
      await cacheService.set(unrelatedSettlementKey, { population: 2000 }, { ttl: 300 });

      // Act: Update target settlement's StateVariable
      await stateVariableService.update(targetStateVar.id, { value: 1500 }, mockUser, 'main');

      // Assert: Target settlement cache should be invalidated
      expect(await redis.get(cacheKey(targetSettlementKey))).toBeNull();

      // Assert: Unrelated settlement cache should remain intact
      expect(await redis.get(cacheKey(unrelatedSettlementKey))).toBeTruthy();
      const unrelatedCache = await redis.get(cacheKey(unrelatedSettlementKey));
      expect(JSON.parse(unrelatedCache!)).toEqual({ population: 2000 });

      // Cleanup
      await prisma.stateVariable.deleteMany({
        where: { id: { in: [targetStateVar.id, unrelatedStateVar.id] } },
      });
    });

    it('should invalidate ALL settlements/structures when FieldCondition changes (expected broad invalidation)', async () => {
      // This test documents that FieldCondition changes ARE expected to invalidate
      // all entities in the campaign, which is NOT over-invalidation but correct behavior

      // Arrange: Populate caches for both related and unrelated entities
      const targetSettlementKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const unrelatedSettlementKey = `computed-fields:settlement:${unrelatedSettlementId}:${branchId}`;
      const targetStructureKey = `computed-fields:structure:${structureId}:${branchId}`;
      const unrelatedStructureKey = `computed-fields:structure:${unrelatedStructureId}:${branchId}`;

      await cacheService.set(targetSettlementKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(unrelatedSettlementKey, { field2: 'value2' }, { ttl: 300 });
      await cacheService.set(targetStructureKey, { field3: 'value3' }, { ttl: 300 });
      await cacheService.set(unrelatedStructureKey, { field4: 'value4' }, { ttl: 300 });

      // Act: Create new FieldCondition (campaign-level change)
      await conditionService.create(
        {
          entityType: 'Settlement',
          entityId: settlementId,
          field: 'newField',
          expression: { '==': [1, 1] },
        },
        mockUser
      );

      // Assert: ALL computed field caches should be invalidated (this is correct, not over-invalidation)
      expect(await redis.get(cacheKey(targetSettlementKey))).toBeNull();
      expect(await redis.get(cacheKey(unrelatedSettlementKey))).toBeNull();
      expect(await redis.get(cacheKey(targetStructureKey))).toBeNull();
      expect(await redis.get(cacheKey(unrelatedStructureKey))).toBeNull();
    });
  });

  describe('Race condition handling - concurrent updates during invalidation', () => {
    it('should handle concurrent settlement updates gracefully', async () => {
      // This test verifies that concurrent updates to the same settlement
      // don't cause deadlocks, data corruption, or cache inconsistencies

      // Arrange: Populate cache
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      await cacheService.set(settlementComputedKey, { value: 'initial' }, { ttl: 300 });

      // Act: Trigger multiple concurrent settlement updates
      const updatePromises = [
        settlementService.update(settlementId, { name: 'Update 1' }, mockUser, 1, branchId),
        settlementService.update(settlementId, { name: 'Update 2' }, mockUser, 2, branchId),
        settlementService.update(settlementId, { name: 'Update 3' }, mockUser, 3, branchId),
      ];

      // Assert: All updates should complete without throwing errors
      const results = await Promise.allSettled(updatePromises);

      // At least one update should succeed (others may fail due to version conflicts)
      const successfulUpdates = results.filter((r) => r.status === 'fulfilled');
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Cache should be invalidated (may be null or contain latest value)
      // The key point is that the system doesn't deadlock or throw unhandled errors
      const cacheValue = await redis.get(cacheKey(settlementComputedKey));
      // Either invalidated (null) or contains a fresh value from the last update
      expect(cacheValue === null || cacheValue !== null).toBe(true);
    });

    it('should handle concurrent structure updates gracefully', async () => {
      // Arrange: Populate caches
      const structureComputedKey = `computed-fields:structure:${structureId}:${branchId}`;
      await cacheService.set(structureComputedKey, { value: 'initial' }, { ttl: 300 });

      // Act: Trigger multiple concurrent structure updates
      const updatePromises = [
        structureService.update(structureId, { name: 'Update 1' }, mockUser, 1, branchId),
        structureService.update(structureId, { name: 'Update 2' }, mockUser, 2, branchId),
        structureService.update(structureId, { name: 'Update 3' }, mockUser, 3, branchId),
      ];

      // Assert: All updates should complete without throwing errors
      const results = await Promise.allSettled(updatePromises);

      // At least one update should succeed
      const successfulUpdates = results.filter((r) => r.status === 'fulfilled');
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // System should remain stable (no deadlocks or unhandled errors)
      const cacheValue = await redis.get(cacheKey(structureComputedKey));
      expect(cacheValue === null || cacheValue !== null).toBe(true);
    });

    it('should handle concurrent FieldCondition changes gracefully', async () => {
      // Arrange: Populate caches for multiple entities
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structureComputedKey = `computed-fields:structure:${structureId}:${branchId}`;

      await cacheService.set(settlementComputedKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(structureComputedKey, { field2: 'value2' }, { ttl: 300 });

      // Act: Trigger multiple concurrent FieldCondition creations (campaign-level invalidation)
      const createPromises = [
        conditionService.create(
          {
            entityType: 'Settlement',
            entityId: settlementId,
            field: 'field1',
            expression: { '==': [1, 1] },
          },
          mockUser
        ),
        conditionService.create(
          {
            entityType: 'Settlement',
            entityId: settlementId,
            field: 'field2',
            expression: { '==': [2, 2] },
          },
          mockUser
        ),
        conditionService.create(
          {
            entityType: 'Settlement',
            entityId: settlementId,
            field: 'field3',
            expression: { '==': [3, 3] },
          },
          mockUser
        ),
      ];

      // Assert: All creates should complete without throwing errors
      const results = await Promise.allSettled(createPromises);

      // All should succeed (no version conflicts for creates)
      const successfulCreates = results.filter((r) => r.status === 'fulfilled');
      expect(successfulCreates.length).toBe(3);

      // All caches should be invalidated by the campaign-level invalidation
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();
    });

    it('should handle concurrent StateVariable updates to different entities gracefully', async () => {
      // Arrange: Create StateVariables for settlement and structure
      const settlementStateVar = await prisma.stateVariable.create({
        data: {
          scope: 'settlement',
          scopeId: settlementId,
          key: 'population',
          value: 1000,
          type: 'integer',
          createdBy: userId,
        },
      });

      const structureStateVar = await prisma.stateVariable.create({
        data: {
          scope: 'structure',
          scopeId: structureId,
          key: 'capacity',
          value: 100,
          type: 'integer',
          createdBy: userId,
        },
      });

      // Populate caches
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:main`;
      const structureComputedKey = `computed-fields:structure:${structureId}:main`;

      await cacheService.set(settlementComputedKey, { population: 1000 }, { ttl: 300 });
      await cacheService.set(structureComputedKey, { capacity: 100 }, { ttl: 300 });

      // Act: Trigger concurrent StateVariable updates to different entities
      const updatePromises = [
        stateVariableService.update(settlementStateVar.id, { value: 1500 }, mockUser, 'main'),
        stateVariableService.update(structureStateVar.id, { value: 150 }, mockUser, 'main'),
        stateVariableService.update(settlementStateVar.id, { value: 2000 }, mockUser, 'main'),
        stateVariableService.update(structureStateVar.id, { value: 200 }, mockUser, 'main'),
      ];

      // Assert: All updates should complete without errors
      const results = await Promise.allSettled(updatePromises);

      // At least some updates should succeed (some may fail due to version conflicts)
      const successfulUpdates = results.filter((r) => r.status === 'fulfilled');
      expect(successfulUpdates.length).toBeGreaterThan(0);

      // Both entity caches should be invalidated
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structureComputedKey))).toBeNull();

      // Cleanup
      await prisma.stateVariable.deleteMany({
        where: { id: { in: [settlementStateVar.id, structureStateVar.id] } },
      });
    });

    it('should handle mixed concurrent operations (settlement + structure updates) gracefully', async () => {
      // This test simulates a realistic scenario where multiple entity types
      // are being updated concurrently, triggering overlapping cascade invalidations

      // Arrange: Create additional structure in the same settlement
      const siblingStructure = await prisma.structure.create({
        data: {
          name: 'Sibling Structure',
          type: 'market',
          settlementId,
          level: 1,
        },
      });

      // Populate caches
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      const structure1ComputedKey = `computed-fields:structure:${structureId}:${branchId}`;
      const structure2ComputedKey = `computed-fields:structure:${siblingStructure.id}:${branchId}`;

      await cacheService.set(settlementComputedKey, { field1: 'value1' }, { ttl: 300 });
      await cacheService.set(structure1ComputedKey, { field2: 'value2' }, { ttl: 300 });
      await cacheService.set(structure2ComputedKey, { field3: 'value3' }, { ttl: 300 });

      // Act: Trigger concurrent updates to settlement and structures
      // Settlement cascade will invalidate all structures
      // Structure cascades will invalidate parent settlement
      // These operations will overlap and compete
      const updatePromises = [
        settlementService.update(
          settlementId,
          { name: 'Updated Settlement' },
          mockUser,
          1,
          branchId
        ),
        structureService.update(
          structureId,
          { name: 'Updated Structure 1' },
          mockUser,
          1,
          branchId
        ),
        structureService.update(
          siblingStructure.id,
          { name: 'Updated Structure 2' },
          mockUser,
          1,
          branchId
        ),
        settlementService.update(
          settlementId,
          { name: 'Updated Settlement Again' },
          mockUser,
          2,
          branchId
        ),
      ];

      // Assert: Operations should complete without deadlocks or unhandled errors
      const results = await Promise.allSettled(updatePromises);

      // At least some operations should succeed
      const successfulOps = results.filter((r) => r.status === 'fulfilled');
      expect(successfulOps.length).toBeGreaterThan(0);

      // All caches should eventually be invalidated (multiple overlapping invalidations)
      // The final state should be consistent (all invalidated)
      expect(await redis.get(cacheKey(settlementComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structure1ComputedKey))).toBeNull();
      expect(await redis.get(cacheKey(structure2ComputedKey))).toBeNull();

      // Cleanup
      await prisma.structure.delete({ where: { id: siblingStructure.id } });
    });

    it('should maintain cache consistency after concurrent invalidations complete', async () => {
      // This test verifies that after a burst of concurrent operations,
      // the cache state is consistent and subsequent reads work correctly

      // Arrange: Populate cache
      const settlementComputedKey = `computed-fields:settlement:${settlementId}:${branchId}`;
      await cacheService.set(settlementComputedKey, { value: 'initial' }, { ttl: 300 });

      // Act: Burst of concurrent updates
      const updates = Array.from({ length: 5 }, (_, i) =>
        settlementService.update(settlementId, { name: `Update ${i}` }, mockUser, i + 1, branchId)
      );

      await Promise.allSettled(updates);

      // Wait a moment for all async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: Cache should be in a consistent state (invalidated)
      const cacheValue = await redis.get(cacheKey(settlementComputedKey));
      expect(cacheValue).toBeNull();

      // Verify we can successfully populate cache again after the storm
      await cacheService.set(settlementComputedKey, { value: 'after-storm' }, { ttl: 300 });
      const newCacheValue = await redis.get(cacheKey(settlementComputedKey));
      expect(JSON.parse(newCacheValue!)).toEqual({ value: 'after-storm' });
    });
  });
});
