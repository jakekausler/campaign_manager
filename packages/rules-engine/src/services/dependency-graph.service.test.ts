/**
 * Unit tests for DependencyGraphService
 * Tests caching, invalidation, and graph operations
 */

import { Logger } from '@nestjs/common';

import { DependencyNodeType, DependencyEdgeType } from '../types/dependency-graph.types';
import { DependencyGraph } from '../utils/dependency-graph';

import { DependencyGraphBuilderService } from './dependency-graph-builder.service';
import { DependencyGraphService } from './dependency-graph.service';

// Mock the builder service
jest.mock('./dependency-graph-builder.service');

describe('DependencyGraphService', () => {
  let service: DependencyGraphService;
  let mockBuilder: jest.Mocked<DependencyGraphBuilderService>;

  beforeEach(() => {
    // Create mock builder with all required methods
    mockBuilder = {
      buildGraphForCampaign: jest.fn(),
      updateGraphForCondition: jest.fn(),
      updateGraphForVariable: jest.fn(),
      removeFromGraph: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraphBuilderService>;

    // Create service with mocked dependencies
    service = new DependencyGraphService(mockBuilder);

    // Suppress logger output
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGraph', () => {
    it('should build and cache graph on first access', async () => {
      const mockGraph = new DependencyGraph();
      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      const result = await service.getGraph('campaign-1', 'main');

      expect(result).toBe(mockGraph);
      expect(mockBuilder.buildGraphForCampaign).toHaveBeenCalledWith('campaign-1', 'main');
      expect(mockBuilder.buildGraphForCampaign).toHaveBeenCalledTimes(1);
    });

    it('should return cached graph on subsequent access', async () => {
      const mockGraph = new DependencyGraph();
      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      // First call - should build
      await service.getGraph('campaign-1', 'main');

      // Second call - should use cache
      const result = await service.getGraph('campaign-1', 'main');

      expect(result).toBe(mockGraph);
      expect(mockBuilder.buildGraphForCampaign).toHaveBeenCalledTimes(1);
    });

    it('should cache graphs separately by campaign and branch', async () => {
      const mockGraph1 = new DependencyGraph();
      const mockGraph2 = new DependencyGraph();

      mockBuilder.buildGraphForCampaign
        .mockResolvedValueOnce(mockGraph1)
        .mockResolvedValueOnce(mockGraph2);

      const result1 = await service.getGraph('campaign-1', 'main');
      const result2 = await service.getGraph('campaign-2', 'main');

      expect(result1).toBe(mockGraph1);
      expect(result2).toBe(mockGraph2);
      expect(mockBuilder.buildGraphForCampaign).toHaveBeenCalledTimes(2);
    });

    it('should default to main branch', async () => {
      const mockGraph = new DependencyGraph();
      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      await service.getGraph('campaign-1');

      expect(mockBuilder.buildGraphForCampaign).toHaveBeenCalledWith('campaign-1', 'main');
    });
  });

  describe('invalidateGraph', () => {
    it('should clear cached graph', async () => {
      const mockGraph1 = new DependencyGraph();
      const mockGraph2 = new DependencyGraph();

      mockBuilder.buildGraphForCampaign
        .mockResolvedValueOnce(mockGraph1)
        .mockResolvedValueOnce(mockGraph2);

      // Build and cache
      await service.getGraph('campaign-1', 'main');

      // Invalidate
      service.invalidateGraph('campaign-1', 'main');

      // Should rebuild
      const result = await service.getGraph('campaign-1', 'main');

      expect(result).toBe(mockGraph2);
      expect(mockBuilder.buildGraphForCampaign).toHaveBeenCalledTimes(2);
    });

    it('should handle invalidation of non-existent cache', () => {
      expect(() => {
        service.invalidateGraph('non-existent', 'main');
      }).not.toThrow();
    });
  });

  describe('getDependenciesOf', () => {
    it('should return upstream dependencies', async () => {
      const mockGraph = new DependencyGraph();

      // Add nodes and edges
      mockGraph.addNode({ id: 'CONDITION:1', type: DependencyNodeType.CONDITION, entityId: '1' });
      mockGraph.addNode({ id: 'VARIABLE:x', type: DependencyNodeType.VARIABLE, entityId: 'x' });
      mockGraph.addEdge({
        fromId: 'CONDITION:1',
        toId: 'VARIABLE:x',
        type: DependencyEdgeType.READS,
      });

      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      const dependencies = await service.getDependenciesOf('campaign-1', 'main', 'CONDITION:1');

      expect(dependencies).toEqual(['VARIABLE:x']);
    });
  });

  describe('getDependentsOf', () => {
    it('should return downstream dependents', async () => {
      const mockGraph = new DependencyGraph();

      // Add nodes and edges
      mockGraph.addNode({ id: 'CONDITION:1', type: DependencyNodeType.CONDITION, entityId: '1' });
      mockGraph.addNode({ id: 'VARIABLE:x', type: DependencyNodeType.VARIABLE, entityId: 'x' });
      mockGraph.addEdge({
        fromId: 'CONDITION:1',
        toId: 'VARIABLE:x',
        type: DependencyEdgeType.READS,
      });

      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      const dependents = await service.getDependentsOf('campaign-1', 'main', 'VARIABLE:x');

      expect(dependents).toEqual(['CONDITION:1']);
    });
  });

  describe('validateNoCycles', () => {
    it('should detect no cycles in valid graph', async () => {
      const mockGraph = new DependencyGraph();

      // Add acyclic graph
      mockGraph.addNode({ id: 'A', type: DependencyNodeType.CONDITION, entityId: 'a' });
      mockGraph.addNode({ id: 'B', type: DependencyNodeType.VARIABLE, entityId: 'b' });
      mockGraph.addEdge({ fromId: 'A', toId: 'B', type: DependencyEdgeType.READS });

      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      const result = await service.validateNoCycles('campaign-1', 'main');

      expect(result.hasCycles).toBe(false);
      expect(result.cycleCount).toBe(0);
    });
  });

  describe('getEvaluationOrder', () => {
    it('should return topological sort order', async () => {
      const mockGraph = new DependencyGraph();

      // Add nodes
      mockGraph.addNode({ id: 'CONDITION:1', type: DependencyNodeType.CONDITION, entityId: '1' });
      mockGraph.addNode({ id: 'VARIABLE:x', type: DependencyNodeType.VARIABLE, entityId: 'x' });
      mockGraph.addEdge({
        fromId: 'CONDITION:1',
        toId: 'VARIABLE:x',
        type: DependencyEdgeType.READS,
      });

      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      const result = await service.getEvaluationOrder('campaign-1', 'main');

      expect(result.success).toBe(true);
      expect(result.order).toContain('CONDITION:1');
      expect(result.order).toContain('VARIABLE:x');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const mockGraph = new DependencyGraph();
      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      // Build some graphs
      await service.getGraph('campaign-1', 'main');
      await service.getGraph('campaign-2', 'dev');

      const stats = service.getCacheStats();

      expect(stats.cachedGraphs).toBe(2);
      expect(stats.cacheKeys).toContain('campaign-1:main');
      expect(stats.cacheKeys).toContain('campaign-2:dev');
    });
  });

  describe('clearAllCaches', () => {
    it('should clear all cached graphs', async () => {
      const mockGraph = new DependencyGraph();
      mockBuilder.buildGraphForCampaign.mockResolvedValue(mockGraph);

      // Build some graphs
      await service.getGraph('campaign-1', 'main');
      await service.getGraph('campaign-2', 'main');

      // Clear all
      service.clearAllCaches();

      const stats = service.getCacheStats();
      expect(stats.cachedGraphs).toBe(0);
    });
  });
});
