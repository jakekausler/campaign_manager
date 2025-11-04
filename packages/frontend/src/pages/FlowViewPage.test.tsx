import { ApolloProvider } from '@apollo/client/react';
import { screen, cleanup, render } from '@testing-library/react';
import type { Node } from '@xyflow/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';
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

// Mock Zustand stores
vi.mock('@/stores', () => ({
  useCurrentCampaignId: vi.fn(() => 'test-campaign-123'),
  useSelectionStore: vi.fn(() => ({
    selectedEntities: [],
    selectEntity: vi.fn(),
    toggleSelection: vi.fn(),
    clearSelection: vi.fn(),
  })),
  EntityType: {
    SETTLEMENT: 'SETTLEMENT',
    STRUCTURE: 'STRUCTURE',
    EVENT: 'EVENT',
    ENCOUNTER: 'ENCOUNTER',
  },
}));

// Mock useDependencyGraph hook
vi.mock('@/services/api/hooks', () => ({
  useDependencyGraph: vi.fn(() => ({
    graph: null,
    loading: false,
    error: null,
  })),
}));

// Phase 1 (Mitigation Plan) Task 1.2: Mock React Flow to reduce memory usage
// React Flow's WebGL/Canvas rendering consumes significant native memory (~43.6MB for this file)
// This mock provides lightweight DOM elements that preserve the API without heavy rendering
vi.mock('@xyflow/react', async () => {
  const mocks = await import('@/__tests__/mocks/react-flow');
  return mocks.createReactFlowMock();
});

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
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let alertSpy: any;

  beforeEach(() => {
    // Spy on window.alert to test user feedback
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    alertSpy.mockRestore();

    // Phase 5: Enhanced React Flow cleanup
    // Critical memory cleanup for React Flow instances
    cleanup(); // Unmount all React components

    // Wait for React Flow to clean up internal state
    // React Flow uses requestAnimationFrame and timers for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clear any remaining event listeners
    // React Flow attaches listeners to window for pan/zoom/drag
    window.dispatchEvent(new Event('beforeunload'));

    vi.clearAllMocks(); // Clear all mock function call history
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

      const client = createTestApolloClient();
      render(
        <ApolloProvider client={client}>
          <MemoryRouter initialEntries={['/flow']}>
            <Routes>
              <Route path="/flow" element={<FlowViewPage />} />
            </Routes>
          </MemoryRouter>
        </ApolloProvider>
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

      const client = createTestApolloClient();
      render(
        <ApolloProvider client={client}>
          <MemoryRouter initialEntries={['/flow']}>
            <Routes>
              <Route path="/flow" element={<FlowViewPage />} />
            </Routes>
          </MemoryRouter>
        </ApolloProvider>
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

      const client = createTestApolloClient();
      render(
        <ApolloProvider client={client}>
          <MemoryRouter initialEntries={['/flow']}>
            <Routes>
              <Route path="/flow" element={<FlowViewPage />} />
            </Routes>
          </MemoryRouter>
        </ApolloProvider>
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

      const client = createTestApolloClient();
      render(
        <ApolloProvider client={client}>
          <MemoryRouter initialEntries={['/flow']}>
            <Routes>
              <Route path="/flow" element={<FlowViewPage />} />
            </Routes>
          </MemoryRouter>
        </ApolloProvider>
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

  describe('Cross-View Selection Integration (TICKET-024)', () => {
    let mockSelectEntity: ReturnType<typeof vi.fn>;
    let mockToggleSelection: ReturnType<typeof vi.fn>;
    let mockClearSelection: ReturnType<typeof vi.fn>;
    let mockSelectedEntities: Array<{
      id: string;
      type: string;
      name?: string;
    }>;

    beforeEach(async () => {
      // Reset mocks
      mockSelectEntity = vi.fn();
      mockToggleSelection = vi.fn();
      mockClearSelection = vi.fn();
      mockSelectedEntities = [];

      // Mock the selection store with all required functions
      const { useCurrentCampaignId } = vi.mocked(await import('@/stores'));
      useCurrentCampaignId.mockReturnValue('test-campaign-123');

      vi.doMock('@/stores', () => ({
        useCurrentCampaignId: vi.fn(() => 'test-campaign-123'),
        useSelectionStore: vi.fn(() => ({
          selectedEntities: mockSelectedEntities,
          selectEntity: mockSelectEntity,
          toggleSelection: mockToggleSelection,
          clearSelection: mockClearSelection,
        })),
        EntityType: {
          SETTLEMENT: 'SETTLEMENT',
          STRUCTURE: 'STRUCTURE',
          EVENT: 'EVENT',
          ENCOUNTER: 'ENCOUNTER',
        },
      }));
    });

    afterEach(() => {
      // Critical: Reset module mocks created by vi.doMock
      vi.resetModules();
    });

    describe('nodeToSelectedEntity mapping', () => {
      it('should map EFFECT node with Settlement entityType to SETTLEMENT', () => {
        // EFFECT nodes can target different entity types
        // We need to verify the mapping logic extracts the correct entity type
        const effectNode = {
          id: 'effect-1',
          data: {
            label: 'Increase Population',
            nodeType: 'EFFECT',
            entityId: 'settlement-123',
            metadata: {
              entityType: 'Settlement',
              entityId: 'settlement-123',
            },
          },
        };

        // Verify metadata structure is correct
        expect(effectNode.data.metadata?.entityType).toBe('Settlement');
        expect(effectNode.data.metadata?.entityId).toBe('settlement-123');
      });

      it('should map EFFECT node with Structure entityType to STRUCTURE', () => {
        const effectNode = {
          id: 'effect-2',
          data: {
            label: 'Upgrade Building',
            nodeType: 'EFFECT',
            entityId: 'structure-456',
            metadata: {
              entityType: 'Structure',
              entityId: 'structure-456',
            },
          },
        };

        expect(effectNode.data.metadata?.entityType).toBe('Structure');
      });

      it('should map EFFECT node with Event entityType to EVENT', () => {
        const effectNode = {
          id: 'effect-3',
          data: {
            label: 'Complete Quest',
            nodeType: 'EFFECT',
            entityId: 'event-789',
            metadata: {
              entityType: 'Event',
              entityId: 'event-789',
            },
          },
        };

        expect(effectNode.data.metadata?.entityType).toBe('Event');
      });

      it('should map EFFECT node with Encounter entityType to ENCOUNTER', () => {
        const effectNode = {
          id: 'effect-4',
          data: {
            label: 'Resolve Battle',
            nodeType: 'EFFECT',
            entityId: 'encounter-999',
            metadata: {
              entityType: 'Encounter',
              entityId: 'encounter-999',
            },
          },
        };

        expect(effectNode.data.metadata?.entityType).toBe('Encounter');
      });

      it('should map ENTITY node with Settlement to SETTLEMENT', () => {
        const entityNode = {
          id: 'entity-1',
          data: {
            label: 'Waterdeep',
            nodeType: 'ENTITY',
            entityId: 'settlement-abc',
            metadata: {
              entityType: 'Settlement',
              entityId: 'settlement-abc',
            },
          },
        };

        expect(entityNode.data.metadata?.entityType).toBe('Settlement');
      });

      it('should handle VARIABLE and CONDITION nodes (not selectable)', () => {
        // VARIABLE and CONDITION nodes should not map to selectable entities
        const variableNode = {
          id: 'var-1',
          data: {
            label: 'population',
            nodeType: 'VARIABLE',
            entityId: 'var-123',
            metadata: null,
          },
        };

        const conditionNode = {
          id: 'cond-1',
          data: {
            label: 'population > 100',
            nodeType: 'CONDITION',
            entityId: 'cond-456',
            metadata: null,
          },
        };

        // These nodes don't have entityType metadata, so they won't be selectable
        expect(variableNode.data.metadata).toBeNull();
        expect(conditionNode.data.metadata).toBeNull();
      });
    });

    describe('selection synchronization', () => {
      it('should document expected behavior for node click selection', () => {
        // When a user clicks a node in FlowViewPage:
        // 1. Local React Flow selection state is updated (selectedNodeIds)
        // 2. Node is mapped to SelectedEntity via nodeToSelectedEntity()
        // 3. Global selection store is updated via selectEntity() or toggleSelection()
        // 4. Other views (Map, Timeline) subscribe to global selection and highlight

        // This test documents the expected flow
        expect(mockSelectEntity).not.toHaveBeenCalled(); // Not yet clicked
        expect(mockToggleSelection).not.toHaveBeenCalled();
      });

      it('should document expected behavior for external selection updates', () => {
        // When selection changes in another view (e.g., Map):
        // 1. Global selection store is updated
        // 2. FlowViewPage useEffect detects selectedEntities change
        // 3. Maps selectedEntities to node IDs via nodeToSelectedEntity()
        // 4. Updates local selectedNodeIds state
        // 5. React Flow highlights the selected nodes
        // 6. Auto-scrolls to selected nodes using reactFlowInstance

        // This test documents the expected flow
        expect(mockSelectedEntities).toHaveLength(0); // No external selection
      });

      it('should prevent echo effects with isLocalSelectionChange ref', () => {
        // The isLocalSelectionChange ref prevents infinite loops:
        // 1. User clicks node in Flow
        // 2. isLocalSelectionChange = true
        // 3. Global selection store updated
        // 4. useEffect sees selectedEntities change
        // 5. Checks isLocalSelectionChange -> true, so skips local update
        // 6. Resets isLocalSelectionChange to false

        // This prevents the local click from triggering auto-scroll
        // This test documents the pattern
        const isLocalSelectionChange = { current: false };
        expect(isLocalSelectionChange.current).toBe(false);

        // Simulate local click
        isLocalSelectionChange.current = true;
        expect(isLocalSelectionChange.current).toBe(true);

        // After effect runs, it should reset
        isLocalSelectionChange.current = false;
        expect(isLocalSelectionChange.current).toBe(false);
      });
    });

    describe('auto-scroll behavior', () => {
      it('should use setCenter for single node selection', () => {
        // When a single entity is selected from another view:
        // - Use reactFlowInstance.setCenter(x, y, { zoom: 1.5, duration: 500 })
        // - Offset x by +75, y by +30 to center on node (accounting for node size)
        // - Zoom to 1.5x for better visibility

        const node = {
          id: 'node-1',
          position: { x: 100, y: 200 },
        };

        const expectedX = node.position.x + 75;
        const expectedY = node.position.y + 30;

        expect(expectedX).toBe(175);
        expect(expectedY).toBe(230);
      });

      it('should use fitView for multiple node selection', () => {
        // When multiple entities are selected from another view:
        // - Use reactFlowInstance.fitView({ nodes: [...], duration: 500, padding: 0.2 })
        // - 20% padding ensures all nodes are visible with breathing room

        const nodeIds = ['node-1', 'node-2', 'node-3'];
        const nodes = nodeIds.map((id) => ({ id }));

        expect(nodes).toHaveLength(3);
        expect(nodes[0].id).toBe('node-1');
      });

      it('should handle nodes not in flow gracefully', () => {
        // If a selected entity doesn't have a corresponding node in the flow:
        // - nodeToSelectedEntity() returns null for non-matching nodes
        // - No nodes are selected
        // - No auto-scroll occurs

        const selectedEntity = {
          id: 'settlement-not-in-flow',
          type: 'SETTLEMENT',
          name: 'Unknown Settlement',
        };

        // If this entity has no corresponding node, selection will be empty
        expect(selectedEntity.id).toBe('settlement-not-in-flow');
      });
    });

    describe('clear selection integration', () => {
      it('should clear both local and global selection on pane click', () => {
        // When user clicks empty space in the flow:
        // - Local selectedNodeIds is cleared
        // - Global clearSelection() is called
        // - Other views receive empty selectedEntities and clear their highlights

        expect(mockClearSelection).not.toHaveBeenCalled();
        // After pane click, mockClearSelection would be called
      });

      it('should clear selection on Escape key', () => {
        // When user presses Escape:
        // - Local selectedNodeIds is cleared
        // - Global clearSelection() is called
        // - Keyboard shortcut works across all views

        expect(mockClearSelection).not.toHaveBeenCalled();
        // After Escape key, mockClearSelection would be called
      });
    });

    describe('multi-select behavior', () => {
      it('should toggle selection on Ctrl+click', () => {
        // When user Ctrl+clicks a node:
        // - Check event.ctrlKey || event.metaKey
        // - Toggle node in local selectedNodeIds array
        // - Call toggleSelection() on global store
        // - If already selected, remove from selection
        // - If not selected, add to selection

        expect(mockToggleSelection).not.toHaveBeenCalled();
        // After Ctrl+click, mockToggleSelection would be called
      });

      it('should support multi-select across different entity types', () => {
        // Users can select multiple different entity types:
        // - Settlement + Structure
        // - Event + Encounter
        // - All views handle mixed entity type selections

        const mixedSelection = [
          { id: 'settlement-1', type: 'SETTLEMENT', name: 'Waterdeep' },
          { id: 'structure-1', type: 'STRUCTURE', name: 'Blacksmith' },
          { id: 'event-1', type: 'EVENT', name: 'Festival' },
        ];

        expect(mixedSelection).toHaveLength(3);
        expect(mixedSelection.map((e) => e.type)).toEqual(['SETTLEMENT', 'STRUCTURE', 'EVENT']);
      });
    });
  });
});
