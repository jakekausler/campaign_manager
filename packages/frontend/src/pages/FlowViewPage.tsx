import type { NodeMouseHandler, SelectionMode } from '@xyflow/react';
import { ReactFlow, Background, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  VariableNode,
  ConditionNode,
  EffectNode,
  EntityNode,
  ReadsEdge,
  WritesEdge,
  DependsOnEdge,
  FlowToolbar,
  FlowControls,
  SelectionPanel,
  FlowLoadingSkeleton,
  FilterPanel,
} from '@/components/features/flow';
import { useDependencyGraph } from '@/services/api/hooks';
import { useCurrentCampaignId } from '@/stores';
import {
  transformGraphToFlow,
  calculateSelectionState,
  applySelectionStyles,
  applySelectionEdgeStyles,
  getNodeEditRoute,
  getNodeEditMessage,
  isNodeEditable,
  createEmptyFilters,
  hasActiveFilters,
  filterNodes,
  filterEdges,
  getNodeTypeCount,
  getEdgeTypeCount,
} from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

/**
 * Custom node types for React Flow.
 * Maps node type strings (lowercase) to their corresponding React components.
 * Must match the lowercase types returned by transformNode() in graph-layout.ts
 */
const nodeTypes = {
  variable: VariableNode,
  condition: ConditionNode,
  effect: EffectNode,
  entity: EntityNode,
};

/**
 * Custom edge types for React Flow.
 * Maps edge type strings (lowercase) to their corresponding React components.
 * Must match the lowercase types returned by transformEdge() in graph-layout.ts
 */
const edgeTypes = {
  reads: ReadsEdge,
  writes: WritesEdge,
  dependson: DependsOnEdge,
};

/**
 * FlowViewPage - Interactive dependency graph visualization
 *
 * Displays relationships between entities (variables, conditions, effects,
 * settlements, structures) using React Flow. This is a read-only visualization
 * with selection, highlighting, and navigation features.
 *
 * Part of TICKET-021 implementation.
 */
export default function FlowViewPage() {
  // Get current campaign from store
  const campaignId = useCurrentCampaignId();

  // Navigation hook for routing to edit pages
  const navigate = useNavigate();

  // Fetch dependency graph for the current campaign
  const { graph, loading, error } = useDependencyGraph(campaignId || '');

  // Transform graph data to React Flow format with auto-layout
  // Must be called before any conditional returns (React Hooks rules)
  const initialData = useMemo(
    () => (graph ? transformGraphToFlow(graph) : { nodes: [], edges: [] }),
    [graph]
  );

  // React Flow state management for nodes and edges
  // This allows manual repositioning while preserving the ability to re-layout
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [isLayouting, setIsLayouting] = useState(false);

  // Selection state tracking
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Filter state tracking
  const [filters, setFilters] = useState(() => createEmptyFilters());

  // Calculate selection state with dependencies
  const selectionState = useMemo(
    () => calculateSelectionState(selectedNodeIds, edges),
    [selectedNodeIds, edges]
  );

  // Apply filters to nodes and edges
  const filteredNodes = useMemo(
    () => filterNodes(nodes, edges, filters, selectedNodeIds),
    [nodes, edges, filters, selectedNodeIds]
  );

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((node) => node.id)),
    [filteredNodes]
  );

  const filteredEdges = useMemo(
    () => filterEdges(edges, filteredNodeIds, filters),
    [edges, filteredNodeIds, filters]
  );

  // Apply selection styles to filtered nodes and edges
  const styledNodes = useMemo(
    () => applySelectionStyles(filteredNodes, selectionState),
    [filteredNodes, selectionState]
  );

  const styledEdges = useMemo(
    () => applySelectionEdgeStyles(filteredEdges, selectionState),
    [filteredEdges, selectionState]
  );

  // Get selected node objects for SelectionPanel
  const selectedNodes = useMemo(
    () => nodes.filter((node) => selectedNodeIds.includes(node.id)),
    [nodes, selectedNodeIds]
  );

  // Update nodes and edges when graph data changes
  useEffect(() => {
    setNodes(initialData.nodes);
    setEdges(initialData.edges);
    // Clear selection when graph data changes
    setSelectedNodeIds([]);
  }, [initialData.nodes, initialData.edges, setNodes, setEdges]);

  // Re-layout handler: re-applies auto-layout algorithm to reset node positions
  const handleReLayout = useCallback(() => {
    if (!graph) return;

    setIsLayouting(true);

    // Re-run the full transformation including auto-layout
    const { nodes: newNodes, edges: newEdges } = transformGraphToFlow(graph);
    setNodes(newNodes);
    setEdges(newEdges);
    setIsLayouting(false);
  }, [graph, setNodes, setEdges]);

  // Handle node click for selection
  const handleNodeClick: NodeMouseHandler = useCallback((event, node) => {
    // Check if Shift or Ctrl/Cmd key is pressed for multi-select
    const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;

    setSelectedNodeIds((prev) => {
      if (isMultiSelect) {
        // Toggle selection for multi-select
        if (prev.includes(node.id)) {
          return prev.filter((id) => id !== node.id);
        } else {
          return [...prev, node.id];
        }
      } else {
        // Single selection
        return [node.id];
      }
    });
  }, []);

  // Handle pane click to clear selection
  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds([]);
  }, []);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds([]);
  }, []);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
  }, []);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setFilters(createEmptyFilters());
  }, []);

  // Calculate node type counts for filter panel
  const nodeTypeCounts = useMemo(
    () => ({
      VARIABLE: getNodeTypeCount(nodes, 'VARIABLE'),
      CONDITION: getNodeTypeCount(nodes, 'CONDITION'),
      EFFECT: getNodeTypeCount(nodes, 'EFFECT'),
      ENTITY: getNodeTypeCount(nodes, 'ENTITY'),
    }),
    [nodes]
  );

  // Calculate edge type counts for filter panel
  const edgeTypeCounts = useMemo(
    () => ({
      READS: getEdgeTypeCount(edges, 'READS'),
      WRITES: getEdgeTypeCount(edges, 'WRITES'),
      DEPENDS_ON: getEdgeTypeCount(edges, 'DEPENDS_ON'),
    }),
    [edges]
  );

  // Handle node double-click for editing
  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation(); // Prevent pane click event

      const { nodeType, entityId, label } = node.data;

      if (!campaignId) {
        // eslint-disable-next-line no-alert
        alert('No campaign selected. Cannot navigate to edit page.');
        return;
      }

      // Import DependencyNodeType and assert the type
      // node.data.nodeType comes from FlowNodeData which uses the type from dependency-graph
      const typedNodeType = nodeType as import('@/services/api/hooks').DependencyNodeType;
      const typedEntityId = String(entityId);
      const typedLabel = String(label);

      // Check if this node type supports editing
      if (isNodeEditable(typedNodeType)) {
        // Navigate to edit page
        const route = getNodeEditRoute(typedNodeType, typedEntityId, campaignId);
        if (route) {
          navigate(route);
        }
      } else {
        // Show informational message about edit functionality
        const message = getNodeEditMessage(typedNodeType, typedEntityId, typedLabel);
        // eslint-disable-next-line no-alert
        alert(message);
      }
    },
    [campaignId, navigate]
  );

  // Keyboard shortcut for clearing selection (Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedNodeIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show loading state with skeleton
  if (loading) {
    return <FlowLoadingSkeleton />;
  }

  // Show error state
  if (error) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">
            Failed to load dependency graph
          </div>
          <div className="text-sm text-muted-foreground mt-2">{error.message}</div>
        </div>
      </div>
    );
  }

  // Show empty state if no campaign selected
  if (!campaignId) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">No campaign selected</div>
          <div className="text-sm text-muted-foreground mt-2">
            Please select a campaign to view its dependency graph
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no graph data
  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">No dependencies found</div>
          <div className="text-sm text-muted-foreground mt-2">
            This campaign doesn&apos;t have any conditions, effects, or variables yet
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-background"
        selectionMode={'partial' as SelectionMode}
        multiSelectionKeyCode="Shift"
      >
        <Background />
        <FlowControls />
        <FlowToolbar onReLayout={handleReLayout} isLayouting={isLayouting} />
      </ReactFlow>

      {/* Filter panel for searching and filtering nodes/edges */}
      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        nodeTypeCounts={nodeTypeCounts}
        edgeTypeCounts={edgeTypeCounts}
        hasActiveFilters={hasActiveFilters(filters)}
      />

      {/* Selection panel showing selected node details and dependencies */}
      <SelectionPanel
        selectedNodes={selectedNodes}
        upstreamCount={selectionState.upstreamNodeIds.length}
        downstreamCount={selectionState.downstreamNodeIds.length}
        onClearSelection={handleClearSelection}
      />

      {/* Info panel showing graph stats */}
      <div className="absolute top-4 right-4 bg-card border rounded-lg p-4 shadow-lg max-w-xs">
        <h3 className="font-semibold mb-2">Dependency Graph</h3>
        <div className="text-sm space-y-1">
          <div>Total Nodes: {graph.stats.nodeCount}</div>
          <div>Total Edges: {graph.stats.edgeCount}</div>
          <div className="pt-2 border-t mt-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: NODE_COLORS.VARIABLE.bg }}
              />
              <span>Variables: {graph.stats.variableCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: NODE_COLORS.CONDITION.bg }}
              />
              <span>Conditions: {graph.stats.conditionCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: NODE_COLORS.EFFECT.bg }} />
              <span>Effects: {graph.stats.effectCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: NODE_COLORS.ENTITY.bg }} />
              <span>Entities: {graph.stats.entityCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
