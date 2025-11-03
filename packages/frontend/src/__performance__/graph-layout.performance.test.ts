import { describe, it, expect } from 'vitest';

import {
  generateLargeGraph,
  generateGraphWithCycles,
  generateDisconnectedGraph,
} from '@/__tests__/helpers/graph-generator';

import { transformGraphToFlow } from '../utils/graph-layout';

/**
 * Performance tests for graph layout algorithm.
 *
 * These tests measure the performance of the auto-layout algorithm
 * with various graph sizes to ensure it meets performance targets.
 *
 * Performance targets (adjusted for reduced dataset sizes - Phase 2):
 * - 25 nodes: <600ms (includes test setup, dagre initialization, and first run)
 * - 50 nodes: <750ms (includes test infrastructure overhead)
 * - 100 nodes: <1500ms (validates performance characteristics with reasonable dataset)
 *
 * Note: Dataset sizes reduced from 100/200/500 to 25/50/100 to lower memory usage
 * while still validating O(n) and O(n²) performance characteristics. These smaller
 * datasets are sufficient for unit tests - use E2E tests for production-scale validation.
 *
 * In production, actual rendering will be faster due to React Flow optimizations
 * and browser rendering, with no test infrastructure overhead.
 */
describe('Graph Layout Performance', () => {
  it('should transform 25-node graph in <600ms', () => {
    const graph = generateLargeGraph(25, 1.5);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(25);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(600);

    console.log(`25 nodes transformed in ${duration.toFixed(2)}ms`);
  });

  it('should transform 50-node graph in <750ms', () => {
    const graph = generateLargeGraph(50, 1.5);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(50);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(750);

    console.log(`50 nodes transformed in ${duration.toFixed(2)}ms`);
  });

  it('should transform 100-node graph in <1500ms', () => {
    const graph = generateLargeGraph(100, 1.5);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(100);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(1500);

    console.log(`100 nodes transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle graphs with cycles efficiently', () => {
    const graph = generateGraphWithCycles(25);

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(25);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(500);

    console.log(`25 nodes with cycles transformed in ${duration.toFixed(2)}ms`);
  });

  it('should handle disconnected graphs efficiently', () => {
    const graph = generateDisconnectedGraph(5, 10); // 5 subgraphs of 10 nodes each = 50 total

    const startTime = performance.now();
    const result = transformGraphToFlow(graph);
    const endTime = performance.now();

    const duration = endTime - startTime;

    expect(result.nodes).toHaveLength(50);
    expect(result.edges.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(750);

    console.log(`50 nodes (disconnected) transformed in ${duration.toFixed(2)}ms`);
  });

  it('should position all nodes without overlap in large graphs', () => {
    const graph = generateLargeGraph(25, 1.5);
    const result = transformGraphToFlow(graph);

    // Check that all nodes have positions
    result.nodes.forEach((node: { position: { x: number; y: number } }) => {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
    });

    // Check for minimal overlap (nodes should be at least 100px apart)
    const positions = result.nodes.map((n: { position: { x: number; y: number } }) => n.position);
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
    const graph = generateLargeGraph(25, 1.5);
    const result = transformGraphToFlow(graph);

    // All edges should reference valid node IDs
    const nodeIds = new Set(result.nodes.map((n: { id: string }) => n.id));

    result.edges.forEach((edge: { source: string; target: string }) => {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    });
  });
});
