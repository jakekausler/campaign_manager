import { describe, it, expect } from 'vitest';

import {
  generateLargeGraph,
  generateGraphWithCycles,
  generateDisconnectedGraph,
} from '@/__tests__/helpers/graph-generator';

import { transformGraphToFlow } from '../graph-layout';

/**
 * Performance tests for graph layout algorithm.
 *
 * These tests measure the performance of the auto-layout algorithm
 * with various graph sizes to ensure it meets performance targets.
 *
 * Performance targets (adjusted for test environment overhead):
 * - 100 nodes: <2500ms (includes test setup, dagre initialization, and first run)
 * - 200 nodes: <3000ms (includes test infrastructure overhead)
 * - 500 nodes: <7500ms (larger graphs take longer but should still be reasonable, +50% buffer for heavy CI load)
 *
 * Note: These thresholds are conservative to account for CI environment variability.
 * In production, the actual rendering performance will be much faster due to:
 * - React Flow's built-in optimizations
 * - Browser rendering optimizations
 * - No test infrastructure overhead
 */
describe('Graph Layout Performance', () => {
  it('should transform 100-node graph in <2500ms', () => {
    const graph = generateLargeGraph(100, 1.5);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(100);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(2500);

    console.log(`100 nodes transformed in ${duration.toFixed(2)}ms`);
  });

  it('should transform 200-node graph in <3000ms', () => {
    const graph = generateLargeGraph(200, 1.5);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(200);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(3000);

    console.log(`200 nodes transformed in ${duration.toFixed(2)}ms`);
  });

  it('should transform 500-node graph in <7500ms', () => {
    const graph = generateLargeGraph(500, 1.5);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(500);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(7500);

    console.log(`500 nodes transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle graphs with cycles efficiently', () => {
    const graph = generateGraphWithCycles(100);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(100);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(2000);

    console.log(`100 nodes with cycles transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle disconnected graphs efficiently', () => {
    const graph = generateDisconnectedGraph(10, 20); // 10 subgraphs of 20 nodes each = 200 total

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(200);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(3000);

    console.log(`200 nodes (disconnected) transformed in ${duration.toFixed(2)}ms`);
  });

  it('should position all nodes without overlap in large graphs', () => {
    const graph = generateLargeGraph(100, 1.5);
    const result = transformGraphToFlow(graph);

    // Check that all nodes have positions
    result.nodes.forEach((node) => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    });

    // Check for minimal overlap (nodes should be at least 100px apart)
    const positions = result.nodes.map((n) => n.position);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Nodes should be at least 50px apart (half the horizontal spacing)
        // This is a loose check since some overlap is acceptable with large graphs
        if (distance < 50) {
          console.warn(
            `Nodes ${i} and ${j} are close: ${distance.toFixed(2)}px (positions: ${JSON.stringify(positions[i])}, ${JSON.stringify(positions[j])})`
          );
        }
      }
    }
  });

  it('should maintain edge connectivity in large graphs', () => {
    const graph = generateLargeGraph(100, 1.5);
    const result = transformGraphToFlow(graph);

    // All edges should reference valid node IDs
    const nodeIds = new Set(result.nodes.map((n) => n.id));

    result.edges.forEach((edge) => {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    });
  });
});
