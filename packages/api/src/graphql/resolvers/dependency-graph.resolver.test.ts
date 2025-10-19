/**
 * Dependency Graph Resolver Tests
 * Integration tests for DependencyGraph GraphQL queries and mutations
 */

import type { AuthenticatedUser } from '../context/graphql-context';
import type { DependencyGraphService } from '../services/dependency-graph.service';
import type { DependencyNode } from '../types/dependency-graph.type';
import { DependencyNodeType, DependencyEdgeType } from '../types/dependency-graph.type';
import { DependencyGraph } from '../utils/dependency-graph';

import { DependencyGraphResolver } from './dependency-graph.resolver';

describe('DependencyGraphResolver', () => {
  let resolver: DependencyGraphResolver;
  let mockDependencyGraphService: jest.Mocked<DependencyGraphService>;
  let mockUser: AuthenticatedUser;
  let mockGraph: DependencyGraph;

  beforeEach(() => {
    // Create mock DependencyGraphService
    mockDependencyGraphService = {
      getGraph: jest.fn(),
      invalidateGraph: jest.fn(),
      getDependenciesOf: jest.fn(),
      getDependents: jest.fn(),
      validateNoCycles: jest.fn(),
      getEvaluationOrder: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraphService>;

    // Create resolver with mock
    resolver = new DependencyGraphResolver(mockDependencyGraphService);

    // Create mock user
    mockUser = {
      id: 'user-123',
      email: 'gm@example.com',
      role: 'gm',
    } as AuthenticatedUser;

    // Create mock graph
    mockGraph = new DependencyGraph();
    mockGraph.addNode({
      id: 'VARIABLE:var1',
      type: DependencyNodeType.VARIABLE,
      entityId: 'var1',
      label: 'Variable 1',
    });
    mockGraph.addNode({
      id: 'CONDITION:cond1',
      type: DependencyNodeType.CONDITION,
      entityId: 'cond1',
      label: 'Condition 1',
    });
    mockGraph.addEdge({
      fromId: 'CONDITION:cond1',
      toId: 'VARIABLE:var1',
      type: DependencyEdgeType.READS,
    });
  });

  // ============= Query Resolvers Tests =============

  describe('getDependencyGraph', () => {
    it('should return complete dependency graph with nodes, edges, and stats', async () => {
      mockDependencyGraphService.getGraph.mockResolvedValue(mockGraph);

      const result = await resolver.getDependencyGraph('campaign-123', 'main', mockUser);

      expect(mockDependencyGraphService.getGraph).toHaveBeenCalledWith(
        'campaign-123',
        'main',
        mockUser
      );
      expect(result.campaignId).toBe('campaign-123');
      expect(result.branchId).toBe('main');
      expect(result.nodes).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.stats.nodeCount).toBe(2);
      expect(result.stats.edgeCount).toBe(1);
      expect(result.stats.variableCount).toBe(1);
      expect(result.stats.conditionCount).toBe(1);
      expect(result.stats.effectCount).toBe(0);
      expect(result.stats.entityCount).toBe(0);
      expect(result.builtAt).toBeInstanceOf(Date);
    });

    it('should use default branch when branchId not specified', async () => {
      mockDependencyGraphService.getGraph.mockResolvedValue(new DependencyGraph());

      await resolver.getDependencyGraph('campaign-456', 'main', mockUser);

      expect(mockDependencyGraphService.getGraph).toHaveBeenCalledWith(
        'campaign-456',
        'main',
        mockUser
      );
    });

    it('should return empty graph when no nodes exist', async () => {
      const emptyGraph = new DependencyGraph();
      mockDependencyGraphService.getGraph.mockResolvedValue(emptyGraph);

      const result = await resolver.getDependencyGraph('campaign-789', 'main', mockUser);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
      expect(result.stats.nodeCount).toBe(0);
      expect(result.stats.edgeCount).toBe(0);
    });

    it('should calculate correct stats for graph with multiple node types', async () => {
      const complexGraph = new DependencyGraph();
      complexGraph.addNode({
        id: 'VARIABLE:v1',
        type: DependencyNodeType.VARIABLE,
        entityId: 'v1',
      });
      complexGraph.addNode({
        id: 'VARIABLE:v2',
        type: DependencyNodeType.VARIABLE,
        entityId: 'v2',
      });
      complexGraph.addNode({
        id: 'CONDITION:c1',
        type: DependencyNodeType.CONDITION,
        entityId: 'c1',
      });
      complexGraph.addNode({ id: 'EFFECT:e1', type: DependencyNodeType.EFFECT, entityId: 'e1' });
      complexGraph.addNode({
        id: 'ENTITY:ent1',
        type: DependencyNodeType.ENTITY,
        entityId: 'ent1',
      });

      mockDependencyGraphService.getGraph.mockResolvedValue(complexGraph);

      const result = await resolver.getDependencyGraph('campaign-abc', 'main', mockUser);

      expect(result.stats.variableCount).toBe(2);
      expect(result.stats.conditionCount).toBe(1);
      expect(result.stats.effectCount).toBe(1);
      expect(result.stats.entityCount).toBe(1);
    });
  });

  describe('getNodeDependencies', () => {
    it('should return all nodes that a specific node depends on', async () => {
      const mockDependencies: DependencyNode[] = [
        {
          id: 'VARIABLE:var1',
          type: DependencyNodeType.VARIABLE,
          entityId: 'var1',
          label: 'Variable 1',
        },
        {
          id: 'VARIABLE:var2',
          type: DependencyNodeType.VARIABLE,
          entityId: 'var2',
          label: 'Variable 2',
        },
      ];

      mockDependencyGraphService.getDependenciesOf.mockResolvedValue(mockDependencies);

      const result = await resolver.getNodeDependencies(
        'campaign-123',
        'main',
        'CONDITION:cond1',
        mockUser
      );

      expect(mockDependencyGraphService.getDependenciesOf).toHaveBeenCalledWith(
        'campaign-123',
        'main',
        'CONDITION:cond1',
        mockUser
      );
      expect(result).toEqual(mockDependencies);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when node has no dependencies', async () => {
      mockDependencyGraphService.getDependenciesOf.mockResolvedValue([]);

      const result = await resolver.getNodeDependencies(
        'campaign-456',
        'main',
        'VARIABLE:var1',
        mockUser
      );

      expect(result).toEqual([]);
    });

    it('should work with custom branch', async () => {
      mockDependencyGraphService.getDependenciesOf.mockResolvedValue([]);

      await resolver.getNodeDependencies(
        'campaign-789',
        'feature-branch',
        'CONDITION:cond2',
        mockUser
      );

      expect(mockDependencyGraphService.getDependenciesOf).toHaveBeenCalledWith(
        'campaign-789',
        'feature-branch',
        'CONDITION:cond2',
        mockUser
      );
    });
  });

  describe('getNodeDependents', () => {
    it('should return all nodes that depend on a specific node', async () => {
      const mockDependents: DependencyNode[] = [
        {
          id: 'CONDITION:cond1',
          type: DependencyNodeType.CONDITION,
          entityId: 'cond1',
          label: 'Condition 1',
        },
        {
          id: 'CONDITION:cond2',
          type: DependencyNodeType.CONDITION,
          entityId: 'cond2',
          label: 'Condition 2',
        },
        { id: 'EFFECT:eff1', type: DependencyNodeType.EFFECT, entityId: 'eff1', label: 'Effect 1' },
      ];

      mockDependencyGraphService.getDependents.mockResolvedValue(mockDependents);

      const result = await resolver.getNodeDependents(
        'campaign-123',
        'main',
        'VARIABLE:var1',
        mockUser
      );

      expect(mockDependencyGraphService.getDependents).toHaveBeenCalledWith(
        'campaign-123',
        'main',
        'VARIABLE:var1',
        mockUser
      );
      expect(result).toEqual(mockDependents);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when node has no dependents', async () => {
      mockDependencyGraphService.getDependents.mockResolvedValue([]);

      const result = await resolver.getNodeDependents(
        'campaign-456',
        'main',
        'CONDITION:cond1',
        mockUser
      );

      expect(result).toEqual([]);
    });

    it('should work with custom branch', async () => {
      mockDependencyGraphService.getDependents.mockResolvedValue([]);

      await resolver.getNodeDependents('campaign-789', 'dev-branch', 'VARIABLE:var2', mockUser);

      expect(mockDependencyGraphService.getDependents).toHaveBeenCalledWith(
        'campaign-789',
        'dev-branch',
        'VARIABLE:var2',
        mockUser
      );
    });
  });

  describe('validateDependencyGraph', () => {
    it('should return no cycles for valid DAG', async () => {
      const mockCycleResult = {
        hasCycles: false,
        cycles: [],
        cycleCount: 0,
      };

      mockDependencyGraphService.validateNoCycles.mockResolvedValue(mockCycleResult);

      const result = await resolver.validateDependencyGraph('campaign-123', 'main', mockUser);

      expect(mockDependencyGraphService.validateNoCycles).toHaveBeenCalledWith(
        'campaign-123',
        'main',
        mockUser
      );
      expect(result.hasCycles).toBe(false);
      expect(result.cycles).toEqual([]);
      expect(result.cycleCount).toBe(0);
    });

    it('should detect and return cycle information', async () => {
      const mockCycleResult = {
        hasCycles: true,
        cycles: [
          ['CONDITION:cond1', 'VARIABLE:var1', 'CONDITION:cond2'],
          ['EFFECT:eff1', 'VARIABLE:var2', 'EFFECT:eff2'],
        ],
        cycleCount: 2,
      };

      mockDependencyGraphService.validateNoCycles.mockResolvedValue(mockCycleResult);

      const result = await resolver.validateDependencyGraph('campaign-456', 'main', mockUser);

      expect(result.hasCycles).toBe(true);
      expect(result.cycles).toHaveLength(2);
      expect(result.cycles[0].path).toEqual([
        'CONDITION:cond1',
        'VARIABLE:var1',
        'CONDITION:cond2',
      ]);
      expect(result.cycles[0].description).toContain('Cycle detected');
      expect(result.cycles[1].path).toEqual(['EFFECT:eff1', 'VARIABLE:var2', 'EFFECT:eff2']);
      expect(result.cycleCount).toBe(2);
    });

    it('should generate descriptive cycle descriptions', async () => {
      const mockCycleResult = {
        hasCycles: true,
        cycles: [['NODE:a', 'NODE:b', 'NODE:c']],
        cycleCount: 1,
      };

      mockDependencyGraphService.validateNoCycles.mockResolvedValue(mockCycleResult);

      const result = await resolver.validateDependencyGraph('campaign-789', 'main', mockUser);

      expect(result.cycles[0].description).toBe(
        'Cycle detected: NODE:a → NODE:b → NODE:c → NODE:a'
      );
    });

    it('should work with custom branch', async () => {
      mockDependencyGraphService.validateNoCycles.mockResolvedValue({
        hasCycles: false,
        cycles: [],
        cycleCount: 0,
      });

      await resolver.validateDependencyGraph('campaign-abc', 'test-branch', mockUser);

      expect(mockDependencyGraphService.validateNoCycles).toHaveBeenCalledWith(
        'campaign-abc',
        'test-branch',
        mockUser
      );
    });
  });

  describe('getEvaluationOrder', () => {
    it('should return topological order for valid graph', async () => {
      const mockOrder = [
        'VARIABLE:var1',
        'VARIABLE:var2',
        'CONDITION:cond1',
        'CONDITION:cond2',
        'EFFECT:eff1',
      ];

      mockDependencyGraphService.getEvaluationOrder.mockResolvedValue(mockOrder);

      const result = await resolver.getEvaluationOrder('campaign-123', 'main', mockUser);

      expect(mockDependencyGraphService.getEvaluationOrder).toHaveBeenCalledWith(
        'campaign-123',
        'main',
        mockUser
      );
      expect(result).toEqual(mockOrder);
      expect(result).toHaveLength(5);
    });

    it('should return empty array when graph has cycles', async () => {
      mockDependencyGraphService.getEvaluationOrder.mockResolvedValue([]);

      const result = await resolver.getEvaluationOrder('campaign-456', 'main', mockUser);

      expect(result).toEqual([]);
    });

    it('should return empty array for empty graph', async () => {
      mockDependencyGraphService.getEvaluationOrder.mockResolvedValue([]);

      const result = await resolver.getEvaluationOrder('campaign-789', 'main', mockUser);

      expect(result).toEqual([]);
    });

    it('should work with custom branch', async () => {
      mockDependencyGraphService.getEvaluationOrder.mockResolvedValue([]);

      await resolver.getEvaluationOrder('campaign-abc', 'staging', mockUser);

      expect(mockDependencyGraphService.getEvaluationOrder).toHaveBeenCalledWith(
        'campaign-abc',
        'staging',
        mockUser
      );
    });
  });

  // ============= Mutation Resolvers Tests =============

  describe('invalidateDependencyGraph', () => {
    it('should invalidate cache and return true for authorized user', async () => {
      mockDependencyGraphService.getGraph.mockResolvedValue(mockGraph);
      mockDependencyGraphService.invalidateGraph.mockReturnValue(undefined);

      const result = await resolver.invalidateDependencyGraph('campaign-123', 'main', mockUser);

      // First verify access by calling getGraph
      expect(mockDependencyGraphService.getGraph).toHaveBeenCalledWith(
        'campaign-123',
        'main',
        mockUser
      );
      // Then invalidate the cache
      expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
        'campaign-123',
        'main'
      );
      expect(result).toBe(true);
    });

    it('should work with custom branch', async () => {
      mockDependencyGraphService.getGraph.mockResolvedValue(mockGraph);
      mockDependencyGraphService.invalidateGraph.mockReturnValue(undefined);

      await resolver.invalidateDependencyGraph('campaign-456', 'feature-branch', mockUser);

      expect(mockDependencyGraphService.getGraph).toHaveBeenCalledWith(
        'campaign-456',
        'feature-branch',
        mockUser
      );
      expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
        'campaign-456',
        'feature-branch'
      );
    });

    it('should verify campaign access before invalidation', async () => {
      // Simulate access verification by having getGraph throw
      mockDependencyGraphService.getGraph.mockRejectedValue(
        new Error('Unauthorized: User does not have access to this campaign')
      );

      await expect(
        resolver.invalidateDependencyGraph('campaign-789', 'main', mockUser)
      ).rejects.toThrow('Unauthorized');

      // Invalidation should not be called if access check fails
      expect(mockDependencyGraphService.invalidateGraph).not.toHaveBeenCalled();
    });

    it('should use default branch when branchId not specified', async () => {
      mockDependencyGraphService.getGraph.mockResolvedValue(mockGraph);
      mockDependencyGraphService.invalidateGraph.mockReturnValue(undefined);

      await resolver.invalidateDependencyGraph('campaign-abc', 'main', mockUser);

      expect(mockDependencyGraphService.getGraph).toHaveBeenCalledWith(
        'campaign-abc',
        'main',
        mockUser
      );
      expect(mockDependencyGraphService.invalidateGraph).toHaveBeenCalledWith(
        'campaign-abc',
        'main'
      );
    });
  });
});
