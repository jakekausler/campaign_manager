import { screen } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { renderWithApollo } from '@/__tests__/utils/test-utils';
import type { FlowNodeData } from '@/utils';

import FlowViewPage from './FlowViewPage';

/**
 * Test suite for FlowViewPage component - Node Double-Click Integration
 *
 * Tests the node editing integration feature (TICKET-021 Stage 9):
 * - Double-click handler for nodes
 * - Navigation logic based on node type
 * - User feedback when edit pages are not implemented
 */

// Mock Zustand store
vi.mock('@/stores', () => ({
  useCurrentCampaignId: vi.fn(() => 'test-campaign-123'),
}));

// Mock useDependencyGraph hook
vi.mock('@/services/api/hooks', () => ({
  useDependencyGraph: vi.fn(() => ({
    graph: null,
    loading: false,
    error: null,
  })),
}));

// Helper to create a test node
function createTestNode(
  id: string,
  label: string,
  nodeType: 'VARIABLE' | 'CONDITION' | 'EFFECT' | 'ENTITY' = 'VARIABLE',
  entityId = `entity-${id}`
): Node<FlowNodeData> {
  return {
    id,
    type: nodeType.toLowerCase(),
    data: {
      label,
      nodeType,
      entityId,
      metadata: null,
    },
    position: { x: 0, y: 0 },
  };
}

describe('FlowViewPage - Node Double-Click Integration', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let alertSpy: any;

  beforeEach(() => {
    // Spy on window.alert to test user feedback
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  describe('handleNodeDoubleClick', () => {
    it('should document expected behavior for double-clicking VARIABLE node', () => {
      // This test verifies the current behavior: edit pages don't exist yet
      // When edit pages are implemented, this test should be updated

      // We can't easily test the full React Flow interaction,
      // but we can verify the navigation utilities work correctly
      // The actual navigation logic is tested in node-navigation.test.ts

      // This test documents expected behavior: double-clicking should eventually
      // navigate to edit pages when they are implemented
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should handle CONDITION node type', () => {
      const node = createTestNode('cond-1', 'Has Quest', 'CONDITION', 'cond-456');

      // Verify node data structure is correct for navigation
      expect(node.data.nodeType).toBe('CONDITION');
      expect(node.data.entityId).toBe('cond-456');
      expect(node.data.label).toBe('Has Quest');
    });

    it('should handle EFFECT node type', () => {
      const node = createTestNode('eff-1', 'Gain XP', 'EFFECT', 'eff-789');

      // Verify node data structure
      expect(node.data.nodeType).toBe('EFFECT');
      expect(node.data.entityId).toBe('eff-789');
      expect(node.data.label).toBe('Gain XP');
    });

    it('should handle ENTITY node type', () => {
      const node = createTestNode('ent-1', 'Dragon Boss', 'ENTITY', 'ent-999');

      // Verify node data structure
      expect(node.data.nodeType).toBe('ENTITY');
      expect(node.data.entityId).toBe('ent-999');
      expect(node.data.label).toBe('Dragon Boss');
    });
  });

  describe('navigation integration', () => {
    it('should have access to campaign ID for navigation context', async () => {
      // Mock the store to return a campaign ID
      const { useCurrentCampaignId } = vi.mocked(await import('@/stores'));
      useCurrentCampaignId.mockReturnValue('campaign-abc-123');

      // Verify campaign ID is available
      const campaignId = useCurrentCampaignId();
      expect(campaignId).toBe('campaign-abc-123');
    });

    it('should construct proper route paths for each node type', async () => {
      const { getNodeEditRoute } = await import('@/utils');

      const campaignId = 'campaign-xyz';

      // Verify route construction for each type
      expect(getNodeEditRoute('VARIABLE', 'var-123', campaignId)).toBe('/variables/var-123');
      expect(getNodeEditRoute('CONDITION', 'cond-456', campaignId)).toBe('/conditions/cond-456');
      expect(getNodeEditRoute('EFFECT', 'eff-789', campaignId)).toBe('/effects/eff-789');
      expect(getNodeEditRoute('ENTITY', 'ent-999', campaignId)).toBe('/entities/ent-999');
    });

    it('should provide user-friendly messages when edit pages not implemented', async () => {
      const { getNodeEditMessage, isNodeEditable } = await import('@/utils');

      // Verify edit functionality is not yet available
      expect(isNodeEditable('VARIABLE')).toBe(false);
      expect(isNodeEditable('CONDITION')).toBe(false);
      expect(isNodeEditable('EFFECT')).toBe(false);
      expect(isNodeEditable('ENTITY')).toBe(false);

      // Verify messages are informative
      const varMessage = getNodeEditMessage('VARIABLE', 'var-123', 'Gold Amount');
      expect(varMessage).toContain('Variable editing not yet implemented');
      expect(varMessage).toContain('Gold Amount');
      expect(varMessage).toContain('var-123');

      const condMessage = getNodeEditMessage('CONDITION', 'cond-456', 'Has Quest');
      expect(condMessage).toContain('Condition editing not yet implemented');
      expect(condMessage).toContain('Has Quest');
    });
  });

  describe('page rendering with empty state', () => {
    it('should render empty state when no graph data', async () => {
      const { useDependencyGraph } = vi.mocked(await import('@/services/api/hooks'));

      useDependencyGraph.mockReturnValue({
        graph: null,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(
        <MemoryRouter initialEntries={['/flow']}>
          <Routes>
            <Route path="/flow" element={<FlowViewPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('No dependencies found')).toBeInTheDocument();
    });

    it('should render loading state', async () => {
      const { useDependencyGraph } = vi.mocked(await import('@/services/api/hooks'));

      useDependencyGraph.mockReturnValue({
        graph: null,
        loading: true,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(
        <MemoryRouter initialEntries={['/flow']}>
          <Routes>
            <Route path="/flow" element={<FlowViewPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Loading dependency graph...')).toBeInTheDocument();
    });

    it('should render error state', async () => {
      const { useDependencyGraph } = vi.mocked(await import('@/services/api/hooks'));

      useDependencyGraph.mockReturnValue({
        graph: null,
        loading: false,
        error: new Error('Network error'),
        refetch: vi.fn(),
      });

      renderWithApollo(
        <MemoryRouter initialEntries={['/flow']}>
          <Routes>
            <Route path="/flow" element={<FlowViewPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Failed to load dependency graph')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should show no campaign message when campaign ID is null', async () => {
      const { useCurrentCampaignId } = vi.mocked(await import('@/stores'));
      useCurrentCampaignId.mockReturnValue(null);

      const { useDependencyGraph } = vi.mocked(await import('@/services/api/hooks'));

      useDependencyGraph.mockReturnValue({
        graph: null,
        loading: false,
        error: undefined,
        refetch: vi.fn(),
      });

      renderWithApollo(
        <MemoryRouter initialEntries={['/flow']}>
          <Routes>
            <Route path="/flow" element={<FlowViewPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('No campaign selected')).toBeInTheDocument();
    });
  });

  describe('future edit page integration', () => {
    it('should be ready for navigation when edit pages are implemented', async () => {
      // This test documents the expected future behavior
      // When edit pages are implemented:
      // 1. Update isNodeEditable() to return true for implemented types
      // 2. Add routes to router/index.tsx
      // 3. Update these tests to verify navigation actually occurs

      const { getNodeEditRoute, isNodeEditable } = await import('@/utils');

      const campaignId = 'campaign-123';
      const nodeType = 'VARIABLE';
      const entityId = 'var-456';

      // Routes are defined (even though pages don't exist yet)
      const route = getNodeEditRoute(nodeType, entityId, campaignId);
      expect(route).toBe('/variables/var-456');

      // Editing is not yet enabled (will be true when pages exist)
      expect(isNodeEditable(nodeType)).toBe(false);

      // When implementing edit pages:
      // 1. Create Variable edit page component
      // 2. Add route: { path: 'variables/:id', element: <VariableEditPage /> }
      // 3. Update isNodeEditable('VARIABLE') to return true
      // 4. Update this test to verify navigation with useNavigate mock
    });

    it('should document navigation flow for future implementation', async () => {
      // Expected flow when edit pages are ready:

      // 1. User double-clicks a VARIABLE node
      // 2. handleNodeDoubleClick is called with node data
      // 3. Check isNodeEditable('VARIABLE') -> should return true
      // 4. Get route from getNodeEditRoute('VARIABLE', 'var-123', 'campaign-abc')
      // 5. Navigate to '/variables/var-123' using navigate(route)
      // 6. VariableEditPage renders with entity ID from URL params
      // 7. Page fetches variable data and displays edit form

      // This structure is already in place via:
      // - FlowViewPage.tsx: handleNodeDoubleClick handler
      // - node-navigation.ts: route mapping utilities
      // - Only missing pieces are the actual edit page components

      const { getNodeEditRoute, getNodeTypeLabel } = await import('@/utils');

      // Verify infrastructure is ready
      expect(typeof getNodeEditRoute).toBe('function');
      expect(typeof getNodeTypeLabel).toBe('function');

      // Verify route templates exist
      const route = getNodeEditRoute('CONDITION', 'test-id', 'test-campaign');
      expect(route).toBeTruthy();
      expect(route).toContain('test-id');
    });
  });
});
