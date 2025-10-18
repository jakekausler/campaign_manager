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
    effect: {
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
      effect: {
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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1);
    });

    it('should add effect nodes for all active patch-type effects', async () => {
      const effects = [
        {
          id: 'effect-1',
          name: 'Add treasury gold',
          description: 'Adds gold to treasury',
          effectType: 'patch',
          payload: [{ op: 'add', path: '/treasury', value: 1000 }],
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 100,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: {
            campaignId: 'campaign-1',
          },
          event: null,
        },
        {
          id: 'effect-2',
          name: 'Modify resources',
          description: 'Updates resource values',
          effectType: 'patch',
          payload: [
            { op: 'replace', path: '/resources/gold', value: 500 },
            { op: 'add', path: '/resources/silver', value: 200 },
          ],
          entityType: 'event',
          entityId: 'event-1',
          timing: 'POST',
          priority: 200,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: null,
          event: {
            campaignId: 'campaign-1',
          },
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue(effects as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(2); // 2 effects
      expect(graph.getEdgeCount()).toBe(0); // No edges because no variables

      const node1 = graph.getNode('EFFECT:effect-1');
      expect(node1).toBeDefined();
      expect(node1?.type).toBe(DependencyNodeType.EFFECT);
      expect(node1?.entityId).toBe('effect-1');
      expect(node1?.label).toBe('Add treasury gold');
      expect(node1?.metadata?.effectType).toBe('patch');
      expect(node1?.metadata?.timing).toBe('ON_RESOLVE');
      expect(node1?.metadata?.priority).toBe(100);

      const node2 = graph.getNode('EFFECT:effect-2');
      expect(node2).toBeDefined();
      expect(node2?.type).toBe(DependencyNodeType.EFFECT);
      expect(node2?.entityId).toBe('effect-2');
      expect(node2?.label).toBe('Modify resources');
    });

    it('should create WRITES edges from effects to variables', async () => {
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
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
        {
          id: 'var-2',
          scope: 'kingdom',
          scopeId: 'kingdom-1',
          key: 'resources',
          value: { gold: 100, silver: 50 },
          type: 'object',
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

      const effects = [
        {
          id: 'effect-1',
          name: 'Modify kingdom',
          description: 'Updates kingdom state',
          effectType: 'patch',
          payload: [
            { op: 'add', path: '/treasury', value: 1000 },
            { op: 'replace', path: '/resources/gold', value: 500 },
          ],
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 100,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: {
            campaignId: 'campaign-1',
          },
          event: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue(variables as any);
      prisma.effect.findMany.mockResolvedValue(effects as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(3); // 2 variables + 1 effect
      expect(graph.getEdgeCount()).toBe(2); // effect writes 2 variables

      const edges = graph.getOutgoingEdges('EFFECT:effect-1');
      expect(edges).toHaveLength(2);
      expect(edges[0].type).toBe(DependencyEdgeType.WRITES);
      expect(edges[1].type).toBe(DependencyEdgeType.WRITES);
    });

    it('should filter out non-patch effect types', async () => {
      const effects = [
        {
          id: 'effect-1',
          name: 'Trigger event',
          description: 'Triggers another event',
          effectType: 'trigger_event',
          payload: { eventId: 'event-2' },
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 100,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: {
            campaignId: 'campaign-1',
          },
          event: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue(effects as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(0); // Non-patch effects are filtered in query
      expect(graph.getEdgeCount()).toBe(0);
    });

    it('should filter out effects from other campaigns', async () => {
      const effects = [
        {
          id: 'effect-1',
          name: 'Add treasury gold',
          description: 'Adds gold to treasury',
          effectType: 'patch',
          payload: [{ op: 'add', path: '/treasury', value: 1000 }],
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 100,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: {
            campaignId: 'campaign-2', // Different campaign
          },
          event: null,
        },
        {
          id: 'effect-2',
          name: 'Modify resources',
          description: 'Updates resource values',
          effectType: 'patch',
          payload: [{ op: 'replace', path: '/resources', value: {} }],
          entityType: 'event',
          entityId: 'event-1',
          timing: 'POST',
          priority: 200,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: null,
          event: {
            campaignId: 'campaign-1', // Correct campaign
          },
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue(effects as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1); // Only effect-2
      expect(graph.getNode('EFFECT:effect-1')).toBeUndefined(); // From different campaign
      expect(graph.getNode('EFFECT:effect-2')).toBeDefined();
    });

    it('should handle effects referencing non-existent variables gracefully', async () => {
      const effects = [
        {
          id: 'effect-1',
          name: 'Add treasury gold',
          description: 'Adds gold to treasury',
          effectType: 'patch',
          payload: [{ op: 'add', path: '/treasury', value: 1000 }],
          entityType: 'encounter',
          entityId: 'encounter-1',
          timing: 'ON_RESOLVE',
          priority: 100,
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          encounter: {
            campaignId: 'campaign-1',
          },
          event: null,
        },
      ];

      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]); // No variables
      prisma.effect.findMany.mockResolvedValue(effects as any);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      expect(graph.getNodeCount()).toBe(1); // Just the effect
      expect(graph.getEdgeCount()).toBe(0); // No edges because variable doesn't exist
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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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
      prisma.effect.findMany.mockResolvedValue([]);

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

  describe('updateGraphForEffect', () => {
    it('should update effect node when effect changes', async () => {
      const effect = {
        id: 'effect-1',
        name: 'Original effect',
        description: 'Original description',
        effectType: 'patch',
        payload: [{ op: 'add', path: '/treasury', value: 1000 }],
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 100,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        encounter: {
          campaignId: 'campaign-1',
        },
        event: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([effect as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Update effect with new payload
      const updatedEffect = {
        ...effect,
        name: 'Updated effect',
        payload: [{ op: 'replace', path: '/resources', value: {} }],
        version: 2,
      };

      prisma.effect.findUnique.mockResolvedValue(updatedEffect as any);
      await service.updateGraphForEffect(graph, 'effect-1');

      const node = graph.getNode('EFFECT:effect-1');
      expect(node).toBeDefined();
      expect(node?.label).toBe('Updated effect'); // Updated name
    });

    it('should update effect edges when payload changes', async () => {
      const variable1 = {
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

      const variable2 = {
        id: 'var-2',
        scope: 'kingdom',
        scopeId: 'kingdom-1',
        key: 'resources',
        value: {},
        type: 'object',
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

      const effect = {
        id: 'effect-1',
        name: 'Test effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'add', path: '/treasury', value: 1000 }],
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 100,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        encounter: {
          campaignId: 'campaign-1',
        },
        event: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([variable1, variable2] as any);
      prisma.effect.findMany.mockResolvedValue([effect as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getEdgeCount()).toBe(1); // effect writes treasury

      // Update effect to write different variable
      const updatedEffect = {
        ...effect,
        payload: [{ op: 'replace', path: '/resources', value: {} }],
        version: 2,
      };

      prisma.effect.findUnique.mockResolvedValue(updatedEffect as any);
      await service.updateGraphForEffect(graph, 'effect-1');

      // Should still have 1 edge, but to different variable
      expect(graph.getEdgeCount()).toBe(1);
      const edges = graph.getOutgoingEdges('EFFECT:effect-1');
      expect(edges).toHaveLength(1);
      expect(edges[0].toId).toBe('VARIABLE:var-2'); // Now writes to resources
    });

    it('should remove effect node when effect is deleted', async () => {
      const effect = {
        id: 'effect-1',
        name: 'Test effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'add', path: '/treasury', value: 1000 }],
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 100,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        encounter: {
          campaignId: 'campaign-1',
        },
        event: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([effect as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Simulate deletion
      prisma.effect.findUnique.mockResolvedValue(null);
      await service.updateGraphForEffect(graph, 'effect-1');

      expect(graph.getNodeCount()).toBe(0);
    });

    it('should remove effect node when effect becomes inactive', async () => {
      const effect = {
        id: 'effect-1',
        name: 'Test effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'add', path: '/treasury', value: 1000 }],
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 100,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        encounter: {
          campaignId: 'campaign-1',
        },
        event: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([effect as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Deactivate effect
      prisma.effect.findUnique.mockResolvedValue({
        ...effect,
        isActive: false,
      } as any);
      await service.updateGraphForEffect(graph, 'effect-1');

      expect(graph.getNodeCount()).toBe(0);
    });

    it('should remove effect node when effect changes to non-patch type', async () => {
      const effect = {
        id: 'effect-1',
        name: 'Test effect',
        description: null,
        effectType: 'patch',
        payload: [{ op: 'add', path: '/treasury', value: 1000 }],
        entityType: 'encounter',
        entityId: 'encounter-1',
        timing: 'ON_RESOLVE',
        priority: 100,
        isActive: true,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        encounter: {
          campaignId: 'campaign-1',
        },
        event: null,
      };

      // Build initial graph
      prisma.fieldCondition.findMany.mockResolvedValue([]);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([effect as any]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');
      expect(graph.getNodeCount()).toBe(1);

      // Change effect type
      prisma.effect.findUnique.mockResolvedValue({
        ...effect,
        effectType: 'trigger_event',
        payload: { eventId: 'event-2' },
      } as any);
      await service.updateGraphForEffect(graph, 'effect-1');

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
      prisma.effect.findMany.mockResolvedValue([]);

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
