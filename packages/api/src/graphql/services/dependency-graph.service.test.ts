/**
 * Dependency Graph Service Tests
 * Comprehensive unit tests for high-level dependency graph operations with caching
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { DependencyNodeType } from '../types/dependency-graph.type';
import { DependencyGraph } from '../utils/dependency-graph';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';

describe('DependencyGraphService', () => {
  let service: DependencyGraphService;
  let builder: DependencyGraphBuilderService;
  let prisma: {
    campaign: {
      findFirst: jest.Mock;
    };
  };

  const mockUser = { id: 'user-1', email: 'test@example.com', role: 'gm' };

  beforeEach(async () => {
    const mockPrisma = {
      campaign: {
        findFirst: jest.fn(),
      },
    };

    const mockBuilder = {
      buildGraphForCampaign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependencyGraphService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: DependencyGraphBuilderService,
          useValue: mockBuilder,
        },
      ],
    }).compile();

    service = module.get<DependencyGraphService>(DependencyGraphService);
    builder = module.get<DependencyGraphBuilderService>(DependencyGraphBuilderService);
    prisma = mockPrisma;

    // Suppress logger output during tests
    jest.spyOn(service['logger'], 'debug').mockImplementation();
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  afterEach(() => {
    // Clear cache between tests
    service['graphCache'].clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getGraph', () => {
    it('should build and cache graph on first access', async () => {
      const mockGraph = new DependencyGraph();
      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(mockGraph);

      const graph = await service.getGraph('campaign-1', 'main', mockUser);

      expect(prisma.campaign.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'campaign-1',
          deletedAt: null,
          OR: [
            { ownerId: 'user-1' },
            {
              memberships: {
                some: {
                  userId: 'user-1',
                },
              },
            },
          ],
        },
        select: { id: true },
      });
      expect(builder.buildGraphForCampaign).toHaveBeenCalledWith('campaign-1', 'main');
      expect(graph).toBe(mockGraph);
    });

    it('should return cached graph on subsequent access', async () => {
      const mockGraph = new DependencyGraph();
      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(mockGraph);

      // First access
      await service.getGraph('campaign-1', 'main', mockUser);

      // Second access
      const graph2 = await service.getGraph('campaign-1', 'main', mockUser);

      expect(builder.buildGraphForCampaign).toHaveBeenCalledTimes(1);
      expect(graph2).toBe(mockGraph);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.getGraph('nonexistent', 'main', mockUser)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getGraph('nonexistent', 'main', mockUser)).rejects.toThrow(
        'Campaign with ID nonexistent not found or access denied'
      );
    });

    it('should throw NotFoundException when user has no access', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null); // No campaign found for this user

      await expect(service.getGraph('campaign-1', 'main', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should use default branch "main" when branchId not specified', async () => {
      const mockGraph = new DependencyGraph();
      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(mockGraph);

      await service.getGraph('campaign-1', undefined, mockUser);

      expect(builder.buildGraphForCampaign).toHaveBeenCalledWith('campaign-1', 'main');
    });

    it('should support multiple campaigns with separate caches', async () => {
      const mockGraph1 = new DependencyGraph();
      const mockGraph2 = new DependencyGraph();

      prisma.campaign.findFirst.mockImplementation(({ where }) => {
        return Promise.resolve({ id: where.id });
      });

      jest
        .spyOn(builder, 'buildGraphForCampaign')
        .mockResolvedValueOnce(mockGraph1)
        .mockResolvedValueOnce(mockGraph2);

      const graph1 = await service.getGraph('campaign-1', 'main', mockUser);
      const graph2 = await service.getGraph('campaign-2', 'main', mockUser);

      expect(graph1).toBe(mockGraph1);
      expect(graph2).toBe(mockGraph2);
      expect(graph1).not.toBe(graph2);
      expect(builder.buildGraphForCampaign).toHaveBeenCalledTimes(2);
    });

    it('should support multiple branches with separate caches', async () => {
      const mockGraphMain = new DependencyGraph();
      const mockGraphFeature = new DependencyGraph();

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });

      jest
        .spyOn(builder, 'buildGraphForCampaign')
        .mockResolvedValueOnce(mockGraphMain)
        .mockResolvedValueOnce(mockGraphFeature);

      const graphMain = await service.getGraph('campaign-1', 'main', mockUser);
      const graphFeature = await service.getGraph('campaign-1', 'feature-branch', mockUser);

      expect(graphMain).toBe(mockGraphMain);
      expect(graphFeature).toBe(mockGraphFeature);
      expect(graphMain).not.toBe(graphFeature);
      expect(builder.buildGraphForCampaign).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateGraph', () => {
    it('should remove cached graph', async () => {
      const mockGraph = new DependencyGraph();
      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(mockGraph);

      // Build and cache
      await service.getGraph('campaign-1', 'main', mockUser);

      // Invalidate
      service.invalidateGraph('campaign-1', 'main');

      // Next access should rebuild
      await service.getGraph('campaign-1', 'main', mockUser);

      expect(builder.buildGraphForCampaign).toHaveBeenCalledTimes(2);
    });

    it('should not throw error when invalidating non-existent cache', () => {
      expect(() => {
        service.invalidateGraph('nonexistent', 'main');
      }).not.toThrow();
    });

    it('should only invalidate specified branch', async () => {
      const mockGraphMain = new DependencyGraph();
      const mockGraphFeature = new DependencyGraph();

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });

      jest
        .spyOn(builder, 'buildGraphForCampaign')
        .mockResolvedValueOnce(mockGraphMain)
        .mockResolvedValueOnce(mockGraphFeature);

      // Cache both branches
      await service.getGraph('campaign-1', 'main', mockUser);
      await service.getGraph('campaign-1', 'feature-branch', mockUser);

      // Invalidate only main branch
      service.invalidateGraph('campaign-1', 'main');

      // Main branch should rebuild, feature branch should use cache
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValueOnce(new DependencyGraph());
      await service.getGraph('campaign-1', 'main', mockUser);
      await service.getGraph('campaign-1', 'feature-branch', mockUser);

      // Total calls: 2 initial + 1 rebuild = 3
      expect(builder.buildGraphForCampaign).toHaveBeenCalledTimes(3);
    });

    it('should use default branch "main" when branchId not specified', () => {
      expect(() => {
        service.invalidateGraph('campaign-1');
      }).not.toThrow();
    });
  });

  describe('getDependenciesOf', () => {
    it('should return nodes that the specified node depends on', async () => {
      const graph = new DependencyGraph();

      // Create nodes
      const varNode = {
        id: 'VARIABLE:var-1',
        type: DependencyNodeType.VARIABLE,
        entityId: 'var-1',
        label: 'population',
        metadata: { key: 'population' },
      };
      const condNode = {
        id: 'CONDITION:cond-1',
        type: DependencyNodeType.CONDITION,
        entityId: 'cond-1',
        label: 'Settlement.is_trade_hub',
        metadata: {},
      };

      graph.addNode(varNode);
      graph.addNode(condNode);
      graph.addEdge({
        fromId: 'CONDITION:cond-1',
        toId: 'VARIABLE:var-1',
        type: 'READS' as any,
        metadata: {},
      });

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const dependencies = await service.getDependenciesOf(
        'campaign-1',
        'main',
        'CONDITION:cond-1',
        mockUser
      );

      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].id).toBe('VARIABLE:var-1');
      expect(dependencies[0].type).toBe(DependencyNodeType.VARIABLE);
    });

    it('should return empty array when node has no dependencies', async () => {
      const graph = new DependencyGraph();

      const varNode = {
        id: 'VARIABLE:var-1',
        type: DependencyNodeType.VARIABLE,
        entityId: 'var-1',
        label: 'population',
        metadata: {},
      };

      graph.addNode(varNode);

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const dependencies = await service.getDependenciesOf(
        'campaign-1',
        'main',
        'VARIABLE:var-1',
        mockUser
      );

      expect(dependencies).toHaveLength(0);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(
        service.getDependenciesOf('nonexistent', 'main', 'VARIABLE:var-1', mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDependents', () => {
    it('should return nodes that depend on the specified node', async () => {
      const graph = new DependencyGraph();

      // Create nodes
      const varNode = {
        id: 'VARIABLE:var-1',
        type: DependencyNodeType.VARIABLE,
        entityId: 'var-1',
        label: 'population',
        metadata: { key: 'population' },
      };
      const condNode = {
        id: 'CONDITION:cond-1',
        type: DependencyNodeType.CONDITION,
        entityId: 'cond-1',
        label: 'Settlement.is_trade_hub',
        metadata: {},
      };

      graph.addNode(varNode);
      graph.addNode(condNode);
      graph.addEdge({
        fromId: 'CONDITION:cond-1',
        toId: 'VARIABLE:var-1',
        type: 'READS' as any,
        metadata: {},
      });

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const dependents = await service.getDependents(
        'campaign-1',
        'main',
        'VARIABLE:var-1',
        mockUser
      );

      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe('CONDITION:cond-1');
      expect(dependents[0].type).toBe(DependencyNodeType.CONDITION);
    });

    it('should return empty array when no nodes depend on specified node', async () => {
      const graph = new DependencyGraph();

      const condNode = {
        id: 'CONDITION:cond-1',
        type: DependencyNodeType.CONDITION,
        entityId: 'cond-1',
        label: 'Settlement.is_trade_hub',
        metadata: {},
      };

      graph.addNode(condNode);

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const dependents = await service.getDependents(
        'campaign-1',
        'main',
        'CONDITION:cond-1',
        mockUser
      );

      expect(dependents).toHaveLength(0);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(
        service.getDependents('nonexistent', 'main', 'VARIABLE:var-1', mockUser)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateNoCycles', () => {
    it('should return hasCycle=false for acyclic graph', async () => {
      const graph = new DependencyGraph();

      // Create simple chain: A -> B -> C
      graph.addNode({
        id: 'A',
        type: DependencyNodeType.VARIABLE,
        entityId: 'a',
        label: 'A',
        metadata: {},
      });
      graph.addNode({
        id: 'B',
        type: DependencyNodeType.VARIABLE,
        entityId: 'b',
        label: 'B',
        metadata: {},
      });
      graph.addNode({
        id: 'C',
        type: DependencyNodeType.VARIABLE,
        entityId: 'c',
        label: 'C',
        metadata: {},
      });
      graph.addEdge({ fromId: 'A', toId: 'B', type: 'DEPENDS_ON' as any, metadata: {} });
      graph.addEdge({ fromId: 'B', toId: 'C', type: 'DEPENDS_ON' as any, metadata: {} });

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const result = await service.validateNoCycles('campaign-1', 'main', mockUser);

      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toHaveLength(0);
    });

    it('should return hasCycle=true and cycle path for cyclic graph', async () => {
      const graph = new DependencyGraph();

      // Create cycle: A -> B -> A
      graph.addNode({
        id: 'A',
        type: DependencyNodeType.VARIABLE,
        entityId: 'a',
        label: 'A',
        metadata: {},
      });
      graph.addNode({
        id: 'B',
        type: DependencyNodeType.VARIABLE,
        entityId: 'b',
        label: 'B',
        metadata: {},
      });
      graph.addEdge({ fromId: 'A', toId: 'B', type: 'DEPENDS_ON' as any, metadata: {} });
      graph.addEdge({ fromId: 'B', toId: 'A', type: 'DEPENDS_ON' as any, metadata: {} });

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const result = await service.validateNoCycles('campaign-1', 'main', mockUser);

      expect(result.hasCycles).toBe(true);
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.validateNoCycles('nonexistent', 'main', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getEvaluationOrder', () => {
    it('should return topological order for acyclic graph', async () => {
      const graph = new DependencyGraph();

      // Create simple chain: A -> B -> C
      graph.addNode({
        id: 'A',
        type: DependencyNodeType.VARIABLE,
        entityId: 'a',
        label: 'A',
        metadata: {},
      });
      graph.addNode({
        id: 'B',
        type: DependencyNodeType.VARIABLE,
        entityId: 'b',
        label: 'B',
        metadata: {},
      });
      graph.addNode({
        id: 'C',
        type: DependencyNodeType.VARIABLE,
        entityId: 'c',
        label: 'C',
        metadata: {},
      });
      graph.addEdge({ fromId: 'A', toId: 'B', type: 'DEPENDS_ON' as any, metadata: {} });
      graph.addEdge({ fromId: 'B', toId: 'C', type: 'DEPENDS_ON' as any, metadata: {} });

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const order = await service.getEvaluationOrder('campaign-1', 'main', mockUser);

      // A depends on B, B depends on C, so order should be: C, B, A
      expect(order).toEqual(['C', 'B', 'A']);
    });

    it('should return empty array for cyclic graph', async () => {
      const graph = new DependencyGraph();

      // Create cycle: A -> B -> A
      graph.addNode({
        id: 'A',
        type: DependencyNodeType.VARIABLE,
        entityId: 'a',
        label: 'A',
        metadata: {},
      });
      graph.addNode({
        id: 'B',
        type: DependencyNodeType.VARIABLE,
        entityId: 'b',
        label: 'B',
        metadata: {},
      });
      graph.addEdge({ fromId: 'A', toId: 'B', type: 'DEPENDS_ON' as any, metadata: {} });
      graph.addEdge({ fromId: 'B', toId: 'A', type: 'DEPENDS_ON' as any, metadata: {} });

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const order = await service.getEvaluationOrder('campaign-1', 'main', mockUser);

      expect(order).toEqual([]);
    });

    it('should return empty array for empty graph', async () => {
      const graph = new DependencyGraph();

      prisma.campaign.findFirst.mockResolvedValue({ id: 'campaign-1' });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(graph);

      const order = await service.getEvaluationOrder('campaign-1', 'main', mockUser);

      expect(order).toEqual([]);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.getEvaluationOrder('nonexistent', 'main', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('authorization', () => {
    it('should allow campaign owner access', async () => {
      const mockGraph = new DependencyGraph();
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'campaign-1',
        ownerId: 'user-1', // User is owner
      });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(mockGraph);

      const graph = await service.getGraph('campaign-1', 'main', mockUser);

      expect(graph).toBe(mockGraph);
    });

    it('should allow campaign member access', async () => {
      const mockGraph = new DependencyGraph();
      prisma.campaign.findFirst.mockResolvedValue({
        id: 'campaign-1',
        ownerId: 'other-user',
        memberships: [
          {
            userId: 'user-1', // User is member
            role: 'PLAYER',
          },
        ],
      });
      jest.spyOn(builder, 'buildGraphForCampaign').mockResolvedValue(mockGraph);

      const graph = await service.getGraph('campaign-1', 'main', mockUser);

      expect(graph).toBe(mockGraph);
    });

    it('should deny access to non-members', async () => {
      prisma.campaign.findFirst.mockResolvedValue(null); // No matching campaign found

      await expect(service.getGraph('campaign-1', 'main', mockUser)).rejects.toThrow(
        NotFoundException
      );
    });
  });
});
