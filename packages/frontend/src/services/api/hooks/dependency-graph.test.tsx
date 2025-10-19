/**
 * Tests for useDependencyGraph hook
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, it, expect } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useDependencyGraph } from './dependency-graph';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

describe('useDependencyGraph', () => {
  it('should fetch dependency graph for a campaign', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.graph).toBeNull();
    expect(result.current.error).toBeUndefined();

    // Wait for query to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have graph data
    expect(result.current.graph).not.toBeNull();
    expect(result.current.graph?.nodes).toHaveLength(7);
    expect(result.current.graph?.edges).toHaveLength(7);
    expect(result.current.graph?.stats).toEqual({
      nodeCount: 7,
      edgeCount: 7,
      variableCount: 2,
      conditionCount: 2,
      effectCount: 2,
      entityCount: 1,
    });
    expect(result.current.graph?.campaignId).toBe('campaign-1');
    expect(result.current.graph?.branchId).toBe('main');
  });

  it('should fetch dependency graph with specific branch', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1', 'feature-branch'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.graph?.branchId).toBe('feature-branch');
  });

  it('should handle errors for non-existent campaign', async () => {
    const { result } = renderHook(() => useDependencyGraph('non-existent-campaign'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.graph).toBeNull();
  });

  it('should include correct node types', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const nodes = result.current.graph?.nodes ?? [];
    const nodeTypes = nodes.map((n) => n.type);

    expect(nodeTypes).toContain('VARIABLE');
    expect(nodeTypes).toContain('CONDITION');
    expect(nodeTypes).toContain('EFFECT');
    expect(nodeTypes).toContain('ENTITY');
  });

  it('should include correct edge types', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const edges = result.current.graph?.edges ?? [];
    const edgeTypes = edges.map((e) => e.type);

    expect(edgeTypes).toContain('READS');
    expect(edgeTypes).toContain('WRITES');
    expect(edgeTypes).toContain('DEPENDS_ON');
  });

  it('should preserve node labels', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const nodes = result.current.graph?.nodes ?? [];
    const variableNode = nodes.find((n) => n.id === 'VARIABLE:var-population');

    expect(variableNode).toBeDefined();
    expect(variableNode?.label).toBe('settlement.population');
    expect(variableNode?.metadata).toEqual({
      entityType: 'Settlement',
      fieldName: 'population',
    });
  });

  it('should preserve edge metadata', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const edges = result.current.graph?.edges ?? [];
    const readsEdge = edges.find(
      (e) => e.fromId === 'CONDITION:cond-is-large' && e.toId === 'VARIABLE:var-population'
    );

    expect(readsEdge).toBeDefined();
    expect(readsEdge?.type).toBe('READS');
    expect(readsEdge?.metadata).toEqual({
      fieldPath: 'settlement.population',
    });
  });

  it('should allow manual refetch', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe('function');

    // Refetch should work without throwing
    await expect(result.current.refetch()).resolves.not.toThrow();
  });

  it('should match expected data structure from mock', async () => {
    const { result } = renderHook(() => useDependencyGraph('campaign-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify structure matches what backend returns
    expect(result.current.graph).toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
          entityId: expect.any(String),
        }),
      ]),
      edges: expect.arrayContaining([
        expect.objectContaining({
          fromId: expect.any(String),
          toId: expect.any(String),
          type: expect.any(String),
        }),
      ]),
      stats: expect.objectContaining({
        nodeCount: expect.any(Number),
        edgeCount: expect.any(Number),
        variableCount: expect.any(Number),
        conditionCount: expect.any(Number),
        effectCount: expect.any(Number),
        entityCount: expect.any(Number),
      }),
      campaignId: 'campaign-1',
      branchId: 'main',
      builtAt: expect.any(String),
    });
  });
});
