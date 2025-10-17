/**
 * Dependency Graph Builder Service Tests
 * Comprehensive unit tests for building dependency graphs from database state
 */

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { DependencyNodeType, DependencyEdgeType } from '../types/dependency-graph.type';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';

describe('DependencyGraphBuilderService', () => {
  let service: DependencyGraphBuilderService;
  let prisma: {
    fieldCondition: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    stateVariable: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrisma = {
      fieldCondition: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      stateVariable: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependencyGraphBuilderService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<DependencyGraphBuilderService>(DependencyGraphBuilderService);
    prisma = mockPrisma;

    // Suppress logger output during tests
    jest.spyOn(service['logger'], 'debug').mockImplementation();
    jest.spyOn(service['logger'], 'log').mockImplementation();
    jest.spyOn(service['logger'], 'warn').mockImplementation();
    jest.spyOn(service['logger'], 'error').mockImplementation();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildGraphForCampaign', () => {
    it('should build empty graph when no conditions or variables exist', async () => {
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(0);
      expect(graph.getEdgeCount()).toBe(0);
    });

    it('should add variable nodes for all active state variables', async () => {
      const variables = [
        {
          id: 'var-1',
          scope: 'kingdom',
          scopeId: 'kingdom-1',
          key: 'treasury',
          value: 1000,
          type: 'integer',
          formula: null,
          description: 'Kingdom treasury',
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
        {
          id: 'var-2',
          scope: 'kingdom',
          scopeId: 'kingdom-1',
          key: 'stability',
          value: 50,
          type: 'integer',
          formula: null,
          description: 'Kingdom stability',
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue(variables as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(2);
      expect(graph.getEdgeCount()).toBe(0);

      const node1 = graph.getNode('VARIABLE:var-1');
      expect(node1).toBeDefined();
      expect(node1?.type).toBe(DependencyNodeType.VARIABLE);
      expect(node1?.entityId).toBe('var-1');
      expect(node1?.label).toBe('kingdom:treasury');

      const node2 = graph.getNode('VARIABLE:var-2');
      expect(node2).toBeDefined();
      expect(node2?.type).toBe(DependencyNodeType.VARIABLE);
      expect(node2?.entityId).toBe('var-2');
      expect(node2?.label).toBe('kingdom:stability');
    });

    it('should add condition nodes for all active field conditions', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: { '>': [{ var: 'population' }, 5000] },
          description: 'Settlement is a trade hub',
          isActive: true,
          priority: 100,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1);
      expect(graph.getEdgeCount()).toBe(0);

      const node = graph.getNode('CONDITION:cond-1');
      expect(node).toBeDefined();
      expect(node?.type).toBe(DependencyNodeType.CONDITION);
      expect(node?.entityId).toBe('cond-1');
      expect(node?.label).toBe('Settlement.is_trade_hub');
    });

    it('should create READS edges from conditions to variables', async () => {
      const variables = [
        {
          id: 'var-1',
          scope: 'settlement',
          scopeId: 'settlement-1',
          key: 'population',
          value: 6000,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
        {
          id: 'var-2',
          scope: 'settlement',
          scopeId: 'settlement-1',
          key: 'merchant_count',
          value: 15,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: {
            and: [{ '>': [{ var: 'population' }, 5000] }, { '>': [{ var: 'merchant_count' }, 10] }],
          },
          description: 'Settlement is a trade hub',
          isActive: true,
          priority: 100,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue(variables as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(3); // 2 variables + 1 condition
      expect(graph.getEdgeCount()).toBe(2); // condition reads 2 variables

      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      expect(edges).toHaveLength(2);
      expect(edges[0].type).toBe(DependencyEdgeType.READS);
      expect(edges[1].type).toBe(DependencyEdgeType.READS);
    });

    it('should handle conditions referencing non-existent variables gracefully', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: { '>': [{ var: 'population' }, 5000] },
          description: 'Settlement is a trade hub',
          isActive: true,
          priority: 100,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]); // No variables

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1); // Just the condition
      expect(graph.getEdgeCount()).toBe(0); // No edges because variable doesn't exist
    });

    it('should filter out inactive and deleted variables', async () => {
      const variables = [
        {
          id: 'var-1',
          scope: 'kingdom',
          scopeId: 'kingdom-1',
          key: 'treasury',
          value: 1000,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null, // Active
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue(variables as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1);
    });

    it('should filter out inactive and deleted conditions', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: { '>': [{ var: 'population' }, 5000] },
          description: 'Settlement is a trade hub',
          isActive: true,
          priority: 100,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null, // Active
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      prisma.fieldCondition.findMany.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.buildGraphForCampaign('campaign-1', 'main')).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('updateGraphForCondition', () => {
    it('should add new condition node and edges to existing graph', async () => {
      const condition = {
        id: 'cond-new',
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_prosperous',
        expression: { '>': [{ var: 'wealth' }, 1000] },
        description: null,
        isActive: true,
        priority: 50,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      prisma.fieldCondition.findUnique.mockResolvedValue(condition as any);

      // Build initial graph with just a variable
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([
        {
          id: 'var-1',
          scope: 'settlement',
          scopeId: 'settlement-1',
          key: 'wealth',
          value: 1500,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ] as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Now update with new condition
      await service.updateGraphForCondition(graph, 'cond-new');

      expect(graph.getNodeCount()).toBe(2); // Variable + new condition
      expect(graph.getEdgeCount()).toBe(1); // Edge from condition to variable
    });

    it('should update existing condition node when expression changes', async () => {
      const initialCondition = {
        id: 'cond-1',
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        description: null,
        isActive: true,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      const updatedCondition = {
        ...initialCondition,
        expression: {
          and: [{ '>': [{ var: 'population' }, 5000] }, { '>': [{ var: 'merchant_count' }, 10] }],
        },
        version: 2,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([initialCondition as any]);
      prisma.stateVariable.findMany.mockResolvedValue([
        {
          id: 'var-1',
          scope: 'settlement',
          scopeId: 'settlement-1',
          key: 'population',
          value: 6000,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
        {
          id: 'var-2',
          scope: 'settlement',
          scopeId: 'settlement-1',
          key: 'merchant_count',
          value: 15,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ] as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getEdgeCount()).toBe(1); // Initially reads only 'population'

      // Update condition
      prisma.fieldCondition.findUnique.mockResolvedValue(updatedCondition as any);
      await service.updateGraphForCondition(graph, 'cond-1');

      expect(graph.getNodeCount()).toBe(3); // 2 variables + 1 condition
      expect(graph.getEdgeCount()).toBe(2); // Now reads both variables
    });

    it('should remove condition node when condition is deleted', async () => {
      const condition = {
        id: 'cond-1',
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        description: null,
        isActive: true,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([condition as any]);
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Simulate deletion
      prisma.fieldCondition.findUnique.mockResolvedValue(null);
      await service.updateGraphForCondition(graph, 'cond-1');

      expect(graph.getNodeCount()).toBe(0);
      expect(graph.getEdgeCount()).toBe(0);
    });

    it('should remove condition node when condition becomes inactive', async () => {
      const condition = {
        id: 'cond-1',
        entityType: 'Settlement',
        entityId: 'settlement-1',
        field: 'is_trade_hub',
        expression: { '>': [{ var: 'population' }, 5000] },
        description: null,
        isActive: true,
        priority: 100,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([condition as any]);
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Deactivate condition
      prisma.fieldCondition.findUnique.mockResolvedValue({
        ...condition,
        isActive: false,
      } as any);
      await service.updateGraphForCondition(graph, 'cond-1');

      expect(graph.getNodeCount()).toBe(0);
    });
  });

  describe('updateGraphForVariable', () => {
    it('should add new variable node to existing graph', async () => {
      const variable = {
        id: 'var-new',
        scope: 'kingdom',
        scopeId: 'kingdom-1',
        key: 'treasury',
        value: 1000,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      prisma.stateVariable.findUnique.mockResolvedValue(variable as any);

      // Build empty graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(0);

      // Add new variable
      await service.updateGraphForVariable(graph, 'var-new');

      expect(graph.getNodeCount()).toBe(1);
      const node = graph.getNode('VARIABLE:var-new');
      expect(node).toBeDefined();
      expect(node?.type).toBe(DependencyNodeType.VARIABLE);
    });

    it('should update existing variable node metadata', async () => {
      const initialVariable = {
        id: 'var-1',
        scope: 'kingdom',
        scopeId: 'kingdom-1',
        key: 'treasury',
        value: 1000,
        type: 'integer',
        formula: null,
        description: 'Old description',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      const updatedVariable = {
        ...initialVariable,
        description: 'New description',
        value: 2000,
        version: 2,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([initialVariable as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Update variable
      prisma.stateVariable.findUnique.mockResolvedValue(updatedVariable as any);
      await service.updateGraphForVariable(graph, 'var-1');

      expect(graph.getNodeCount()).toBe(1); // Still 1 node
      const node = graph.getNode('VARIABLE:var-1');
      expect(node?.metadata?.key).toBe('treasury');
    });

    it('should remove variable node when variable is deleted', async () => {
      const variable = {
        id: 'var-1',
        scope: 'kingdom',
        scopeId: 'kingdom-1',
        key: 'treasury',
        value: 1000,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([variable as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Simulate deletion
      prisma.stateVariable.findUnique.mockResolvedValue(null);
      await service.updateGraphForVariable(graph, 'var-1');

      expect(graph.getNodeCount()).toBe(0);
    });

    it('should remove variable node when variable becomes inactive', async () => {
      const variable = {
        id: 'var-1',
        scope: 'kingdom',
        scopeId: 'kingdom-1',
        key: 'treasury',
        value: 1000,
        type: 'integer',
        formula: null,
        description: null,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        createdBy: 'user-1',
        updatedBy: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([variable as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Deactivate variable
      prisma.stateVariable.findUnique.mockResolvedValue({
        ...variable,
        isActive: false,
      } as any);
      await service.updateGraphForVariable(graph, 'var-1');

      expect(graph.getNodeCount()).toBe(0);
    });
  });

  describe('removeFromGraph', () => {
    it('should remove node and all connected edges', async () => {
      const variables = [
        {
          id: 'var-1',
          scope: 'settlement',
          scopeId: 'settlement-1',
          key: 'population',
          value: 6000,
          type: 'integer',
          formula: null,
          description: null,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_trade_hub',
          expression: { '>': [{ var: 'population' }, 5000] },
          description: null,
          isActive: true,
          priority: 100,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue(variables as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(2);
      expect(graph.getEdgeCount()).toBe(1);

      // Remove condition
      service.removeFromGraph(graph, 'CONDITION:cond-1');

      expect(graph.getNodeCount()).toBe(1); // Only variable remains
      expect(graph.getEdgeCount()).toBe(0); // Edge removed
    });
  });
});
