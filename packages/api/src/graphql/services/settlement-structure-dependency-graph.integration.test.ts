/**
 * Settlement & Structure Dependency Graph Integration Tests
 * Tests dependency extraction and graph building for Settlement and Structure custom operators
 */

import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../database/prisma.service';
import { DependencyNodeType } from '../types/dependency-graph.type';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';

describe('Settlement & Structure Dependency Graph Integration', () => {
  let service: DependencyGraphBuilderService;
  let prisma: {
    fieldCondition: {
      findMany: jest.Mock;
    };
    stateVariable: {
      findMany: jest.Mock;
    };
    effect: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    const mockPrisma = {
      fieldCondition: {
        findMany: jest.fn(),
      },
      stateVariable: {
        findMany: jest.fn(),
      },
      effect: {
        findMany: jest.fn(),
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

  describe('Settlement custom operators', () => {
    it('should extract settlement.level dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_major_settlement',
          expression: { '>=': [{ 'settlement.level': [] }, 5] },
          description: 'Settlement is major level (5+)',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      // Should have 2 nodes: 1 condition node + 1 virtual variable node for settlement.level
      expect(graph.getNodeCount()).toBe(2);

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();
      expect(condNode?.type).toBe(DependencyNodeType.CONDITION);

      // Check that virtual variable node was created
      const varNode = graph.getNode('VARIABLE:settlement.level');
      expect(varNode).toBeDefined();
      expect(varNode?.type).toBe(DependencyNodeType.VARIABLE);

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.level');
    });

    it('should extract settlement.var dependencies', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_thriving',
          expression: {
            and: [
              { '>=': [{ 'settlement.var': ['population'] }, 5000] },
              { '==': [{ 'settlement.var': ['prosperity'] }, 'thriving'] },
              { '>=': [{ 'settlement.var': ['defenseRating'] }, 7] },
            ],
          },
          description: 'Settlement is thriving',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.population');
      expect(dependencyIds).toContain('VARIABLE:settlement.prosperity');
      expect(dependencyIds).toContain('VARIABLE:settlement.defenseRating');
    });

    it('should extract settlement.structureCount dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'has_sufficient_barracks',
          expression: { '>=': [{ 'settlement.structureCount': ['barracks'] }, 2] },
          description: 'Settlement has at least 2 barracks',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.structures.count');
    });

    it('should extract settlement.hasStructureType dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'has_religious_center',
          expression: { 'settlement.hasStructureType': ['temple'] },
          description: 'Settlement has at least one temple',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.structures.count');
    });

    it('should extract settlement.inKingdom dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'belongs_to_main_kingdom',
          expression: { 'settlement.inKingdom': ['kingdom-123'] },
          description: 'Settlement belongs to main kingdom',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.kingdomId');
    });

    it('should extract settlement.atLocation dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_at_key_location',
          expression: { 'settlement.atLocation': ['location-456'] },
          description: 'Settlement is at key location',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.locationId');
    });

    it('should extract all dependencies from complex settlement condition', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_strategic_settlement',
          expression: {
            and: [
              { '>=': [{ 'settlement.level': [] }, 5] },
              { '==': [{ 'settlement.var': ['prosperity'] }, 'thriving'] },
              { '>=': [{ 'settlement.var': ['defenseRating'] }, 7] },
              { 'settlement.hasStructureType': ['barracks'] },
              { '>=': [{ 'settlement.structureCount': ['market'] }, 2] },
              { 'settlement.inKingdom': ['kingdom-123'] },
            ],
          },
          description: 'Settlement is strategic (high level, thriving, defended, military, trade)',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.level');
      expect(dependencyIds).toContain('VARIABLE:settlement.prosperity');
      expect(dependencyIds).toContain('VARIABLE:settlement.defenseRating');
      expect(dependencyIds).toContain('VARIABLE:settlement.structures.count');
      expect(dependencyIds).toContain('VARIABLE:settlement.kingdomId');
    });
  });

  describe('Structure custom operators', () => {
    it('should extract structure.level dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'is_advanced_structure',
          expression: { '>=': [{ 'structure.level': [] }, 3] },
          description: 'Structure is advanced level (3+)',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:structure.level');
    });

    it('should extract structure.type dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'is_temple',
          expression: { '==': [{ 'structure.type': [] }, 'temple'] },
          description: 'Structure is a temple',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:structure.type');
    });

    it('should extract structure.var dependencies', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'is_highly_profitable',
          expression: {
            and: [
              { '>': [{ 'structure.var': ['integrity'] }, 80] },
              { '>=': [{ 'structure.var': ['capacity'] }, 100] },
              { '>=': [{ 'structure.var': ['revenue'] }, 500] },
            ],
          },
          description: 'Structure is highly profitable',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:structure.integrity');
      expect(dependencyIds).toContain('VARIABLE:structure.capacity');
      expect(dependencyIds).toContain('VARIABLE:structure.revenue');
    });

    it('should extract structure.isOperational dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'is_functional',
          expression: { 'structure.isOperational': [] },
          description: 'Structure is operational',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:structure.operational');
    });

    it('should extract structure.inSettlement dependency', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'belongs_to_main_settlement',
          expression: { 'structure.inSettlement': ['settlement-789'] },
          description: 'Structure belongs to main settlement',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:structure.settlementId');
    });

    it('should extract all dependencies from complex structure condition', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Structure',
          entityId: 'structure-1',
          field: 'is_elite_temple',
          expression: {
            and: [
              { '==': [{ 'structure.type': [] }, 'temple'] },
              { '>=': [{ 'structure.level': [] }, 5] },
              { 'structure.isOperational': [] },
              { '>': [{ 'structure.var': ['integrity'] }, 90] },
              { '>=': [{ 'structure.var': ['capacity'] }, 200] },
              { 'structure.inSettlement': ['settlement-123'] },
            ],
          },
          description:
            'Structure is an elite temple (high level, operational, excellent condition)',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:structure.type');
      expect(dependencyIds).toContain('VARIABLE:structure.level');
      expect(dependencyIds).toContain('VARIABLE:structure.operational');
      expect(dependencyIds).toContain('VARIABLE:structure.integrity');
      expect(dependencyIds).toContain('VARIABLE:structure.capacity');
      expect(dependencyIds).toContain('VARIABLE:structure.settlementId');
    });
  });

  describe('mixed entity dependencies', () => {
    it('should extract dependencies from condition with both Settlement and Structure operators', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Event',
          entityId: 'event-1',
          field: 'can_trigger',
          expression: {
            and: [
              { '>=': [{ 'settlement.level': [] }, 5] },
              { '==': [{ 'settlement.var': ['prosperity'] }, 'thriving'] },
              { '==': [{ 'structure.type': [] }, 'temple'] },
              { 'structure.isOperational': [] },
            ],
          },
          description: 'Event can trigger: thriving settlement with operational temple',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:settlement.level');
      expect(dependencyIds).toContain('VARIABLE:settlement.prosperity');
      expect(dependencyIds).toContain('VARIABLE:structure.type');
      expect(dependencyIds).toContain('VARIABLE:structure.operational');
    });

    it('should extract dependencies from condition with standard var and custom operators', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Event',
          entityId: 'event-1',
          field: 'complex_trigger',
          expression: {
            and: [
              { '>': [{ var: 'world.time' }, 1000] },
              { '>=': [{ 'settlement.level': [] }, 5] },
              { '>': [{ 'structure.var': ['integrity'] }, 80] },
            ],
          },
          description: 'Complex event trigger with world, settlement, and structure conditions',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // Create a mock StateVariable for 'world' so it has a corresponding node
      const stateVariables = [
        {
          id: 'var-world-time',
          scope: 'world',
          scopeId: 'world-1',
          key: 'world',
          value: null,
          type: 'object',
          formula: null,
          description: 'World state',
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.stateVariable.findMany.mockResolvedValue(stateVariables as any);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      const condNode = graph.getNode('CONDITION:cond-1');
      expect(condNode).toBeDefined();

      // Check edges to verify dependencies
      const edges = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds = edges.map((e) => e.toId);
      expect(dependencyIds).toContain('VARIABLE:var-world-time');
      expect(dependencyIds).toContain('VARIABLE:settlement.level');
      expect(dependencyIds).toContain('VARIABLE:structure.integrity');
    });
  });

  describe('multiple conditions with Settlement/Structure dependencies', () => {
    it('should build graph with multiple conditions depending on same settlement fields', async () => {
      const conditions = [
        {
          id: 'cond-1',
          entityType: 'Settlement',
          entityId: 'settlement-1',
          field: 'is_major',
          expression: { '>=': [{ 'settlement.level': [] }, 5] },
          description: 'Settlement is major',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
        {
          id: 'cond-2',
          entityType: 'Settlement',
          entityId: 'settlement-2',
          field: 'is_capital',
          expression: {
            and: [
              { '>=': [{ 'settlement.level': [] }, 7] },
              { 'settlement.inKingdom': ['kingdom-main'] },
            ],
          },
          description: 'Settlement is capital',
          isActive: true,
          version: 1,
          branch: 'main',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          createdBy: 'user-1',
          updatedBy: null,
        },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma.fieldCondition.findMany.mockResolvedValue(conditions as any);
      prisma.stateVariable.findMany.mockResolvedValue([]);
      prisma.effect.findMany.mockResolvedValue([]);

      const graph = await service.buildGraphForCampaign('campaign-1', 'main');

      // Should have 4 nodes: 2 conditions + 2 virtual variables (settlement.level, settlement.kingdomId)
      expect(graph.getNodeCount()).toBe(4);

      const cond1 = graph.getNode('CONDITION:cond-1');
      expect(cond1).toBeDefined();

      // Verify virtual variable nodes were created
      expect(graph.getNode('VARIABLE:settlement.level')).toBeDefined();
      expect(graph.getNode('VARIABLE:settlement.kingdomId')).toBeDefined();

      // Check edges to verify dependencies for cond-1
      const edges1 = graph.getOutgoingEdges('CONDITION:cond-1');
      const dependencyIds1 = edges1.map((e) => e.toId);
      expect(dependencyIds1).toContain('VARIABLE:settlement.level');

      const cond2 = graph.getNode('CONDITION:cond-2');
      expect(cond2).toBeDefined();

      // Check edges to verify dependencies for cond-2
      const edges2 = graph.getOutgoingEdges('CONDITION:cond-2');
      const dependencyIds2 = edges2.map((e) => e.toId);
      expect(dependencyIds2).toContain('VARIABLE:settlement.level');
      expect(dependencyIds2).toContain('VARIABLE:settlement.kingdomId');
    });
  });
});
