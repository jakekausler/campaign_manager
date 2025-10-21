import type { NodeMouseHandler, SelectionMode, ReactFlowInstance, Node } from '@xyflow/react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { SelectionInfo } from '@/components';
import { EntityInspector } from '@/components/features/entity-inspector';
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
import { useCurrentCampaignId, useSelectionStore, EntityType } from '@/stores';
import {
  transformGraphToFlow,
  calculateSelectionState,
  applySelectionStyles,
  applySelectionEdgeStyles,
  createEmptyFilters,
  hasActiveFilters,
  filterNodes,
  filterEdges,
  getNodeTypeCount,
  getEdgeTypeCount,
  type FlowNodeData,
  type FlowEdgeData,
} from '@/utils';
import { NODE_COLORS } from '@/utils/node-colors';

/**
 * Maps a Flow node to a SelectedEntity for cross-view selection.
 *
 * Flow nodes represent different concepts (variables, conditions, effects, entities).
 * Only EFFECT and ENTITY nodes map to selectable entities (Settlement, Structure, Event, Encounter).
 * VARIABLE and CONDITION nodes are not selectable as they don't represent entities.
 *
 * @param node - The React Flow node
 * @returns SelectedEntity if the node represents a selectable entity, null otherwise
 */
function nodeToSelectedEntity(node: {
  id: string;
  data: {
    nodeType: string;
    label?: string;
    metadata?: Record<string, unknown> | null;
  };
}): import('@/stores').SelectedEntity | null {
  const { nodeType, metadata, label } = node.data;

  // EFFECT nodes may target settlements, structures, events, or encounters
  if (nodeType === 'EFFECT' && metadata) {
    const entityType = metadata.entityType as string | undefined;
    const entityId = metadata.entityId as string | undefined;

    if (!entityId) return null;

    // Map entity type string to EntityType enum
    if (entityType === 'Settlement') {
      return {
        id: entityId,
        type: EntityType.SETTLEMENT,
        name: label,
      };
    } else if (entityType === 'Structure') {
      return {
        id: entityId,
        type: EntityType.STRUCTURE,
        name: label,
      };
    } else if (entityType === 'Event') {
      return {
        id: entityId,
        type: EntityType.EVENT,
        name: label,
      };
    } else if (entityType === 'Encounter') {
      return {
        id: entityId,
        type: EntityType.ENCOUNTER,
        name: label,
      };
    }
  }

  // ENTITY nodes directly represent settlements or structures
  if (nodeType === 'ENTITY' && metadata) {
    const entityType = metadata.entityType as string | undefined;
    const entityId = metadata.entityId as string | undefined;

    if (!entityId) return null;

    if (entityType === 'Settlement') {
      return {
        id: entityId,
        type: EntityType.SETTLEMENT,
        name: label,
      };
    } else if (entityType === 'Structure') {
      return {
        id: entityId,
        type: EntityType.STRUCTURE,
        name: label,
      };
    }
  }

  // VARIABLE and CONDITION nodes are not selectable entities
  return null;
}

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
 * Features:
 * - Interactive dependency graph with auto-layout
 * - Entity inspector for settlements and structures (double-click to open)
 * - Selection highlighting with upstream/downstream traversal
 * - Multi-select with Shift/Ctrl/Cmd keys
 * - Filtering by node type, edge type, and search query
 *
 * Part of TICKET-021 implementation.
 */
export default function FlowViewPage() {
  // Get current campaign from store
  const campaignId = useCurrentCampaignId();

  // Get selection store for cross-view synchronization
  const { selectedEntities, selectEntity, toggleSelection, clearSelection } = useSelectionStore();

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

  // Entity inspector state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'settlement' | 'structure';
    id: string;
  } | null>(null);

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

  // Track if selection change is coming from this view (to prevent loops)
  const isLocalSelectionChange = useRef(false);

  // Store ReactFlow instance for programmatic control
  const reactFlowInstance = useRef<ReactFlowInstance<Node<FlowNodeData>, FlowEdgeData> | null>(
    null
  );

  // Update nodes and edges when graph data changes
  useEffect(() => {
    setNodes(initialData.nodes);
    setEdges(initialData.edges);
    // Clear selection when graph data changes
    setSelectedNodeIds([]);
  }, [initialData.nodes, initialData.edges, setNodes, setEdges]);

  // Subscribe to global selection changes from other views
  // and sync with local React Flow selection
  useEffect(() => {
    // Skip if the selection change originated from this view
    if (isLocalSelectionChange.current) {
      isLocalSelectionChange.current = false;
      return;
    }

    // Map global selected entities to node IDs in this flow
    const nodeIdsToSelect: string[] = [];

    selectedEntities.forEach((entity) => {
      // Find nodes that represent this entity
      nodes.forEach((node) => {
        const nodeEntity = nodeToSelectedEntity(node);
        if (nodeEntity && nodeEntity.id === entity.id && nodeEntity.type === entity.type) {
          nodeIdsToSelect.push(node.id);
        }
      });
    });

    // Update local React Flow selection
    setSelectedNodeIds(nodeIdsToSelect);

    // Auto-scroll/zoom to selected nodes when selection comes from other views
    if (nodeIdsToSelect.length > 0 && reactFlowInstance.current) {
      const instance = reactFlowInstance.current;

      if (nodeIdsToSelect.length === 1) {
        // Single node: use setCenter to pan to the node with zoom
        const node = nodes.find((n) => n.id === nodeIdsToSelect[0]);
        if (node) {
          instance.setCenter(node.position.x + 75, node.position.y + 30, {
            duration: 500,
            zoom: 1.5, // Zoom to 1.5x for better visibility
          });
        }
      } else {
        // Multiple nodes: use fitView to show all selected nodes
        instance.fitView({
          nodes: nodeIdsToSelect.map((id) => ({ id })),
          duration: 500,
          padding: 0.2, // 20% padding around the selection
        });
      }
    }
  }, [selectedEntities, nodes]);

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
  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      // Check if Shift or Ctrl/Cmd key is pressed for multi-select
      const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey;

      // Mark this as a local selection change to prevent echo effect
      isLocalSelectionChange.current = true;

      // Update local React Flow selection state
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

      // Update global selection store for cross-view synchronization
      const selectedEntity = nodeToSelectedEntity(node as Node<FlowNodeData>);
      if (selectedEntity) {
        if (isMultiSelect) {
          // Toggle entity in global selection
          toggleSelection(selectedEntity);
        } else {
          // Replace global selection with this entity
          selectEntity(selectedEntity);
        }
      }
    },
    [selectEntity, toggleSelection]
  );

  // Handle pane click to clear selection
  const handlePaneClick = useCallback(() => {
    setSelectedNodeIds([]);
    clearSelection(); // Clear global selection store
  }, [clearSelection]);

  // Handle clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    clearSelection(); // Clear global selection store
  }, [clearSelection]);

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

  // Handle node double-click to open entity inspector
  const handleNodeDoubleClick: NodeMouseHandler = useCallback((event, node) => {
    event.stopPropagation(); // Prevent pane click event

    const { nodeType, metadata } = node.data;

    // Import DependencyNodeType and assert the type
    // node.data.nodeType comes from FlowNodeData which uses the type from dependency-graph
    const typedNodeType = nodeType as import('@/services/api/hooks').DependencyNodeType;

    // Check for EFFECT nodes that target settlements or structures
    // The dependency graph only has VARIABLE, CONDITION, and EFFECT nodes (no ENTITY nodes)
    if (typedNodeType === 'EFFECT' && metadata) {
      // Extract entity type and ID from effect metadata (typed as Record<string, unknown>)
      const metadataRecord = metadata as Record<string, unknown>;
      const entityType = metadataRecord.entityType as string | undefined;
      const targetEntityId = metadataRecord.entityId as string | undefined;

      // Open inspector for settlement or structure effects
      if (entityType === 'Settlement' && targetEntityId) {
        setSelectedEntity({ type: 'settlement', id: targetEntityId });
        setInspectorOpen(true);
      } else if (entityType === 'Structure' && targetEntityId) {
        setSelectedEntity({ type: 'structure', id: targetEntityId });
        setInspectorOpen(true);
      } else {
        // Show message for effects that don't target settlements/structures
        // eslint-disable-next-line no-alert
        alert(
          `Entity inspector for ${entityType || 'this effect type'} is not yet implemented. Only settlements and structures are currently supported.`
        );
      }
    } else {
      // Show informational message for VARIABLE and CONDITION nodes
      // eslint-disable-next-line no-alert
      alert(
        `Double-click to inspect ${typedNodeType.toLowerCase()} nodes is not yet implemented. Only effect nodes that target settlements or structures can open the entity inspector.`
      );
    }
  }, []);

  // Handle inspector close
  const handleInspectorClose = useCallback(() => {
    setInspectorOpen(false);
    // Don't clear selectedEntity immediately to allow smooth close animation
    setTimeout(() => setSelectedEntity(null), 300);
  }, []);

  // Keyboard shortcut for clearing selection (Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedNodeIds([]);
        clearSelection(); // Clear global selection store
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection]);

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
      <ReactFlowProvider>
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={handlePaneClick}
          onInit={(instance) => {
            reactFlowInstance.current = instance;
          }}
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
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: NODE_COLORS.EFFECT.bg }}
                />
                <span>Effects: {graph.stats.effectCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: NODE_COLORS.ENTITY.bg }}
                />
                <span>Entities: {graph.stats.entityCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Entity Inspector */}
        {selectedEntity && (
          <EntityInspector
            entityType={selectedEntity.type}
            entityId={selectedEntity.id}
            isOpen={inspectorOpen}
            onClose={handleInspectorClose}
          />
        )}

        {/* Selection Info - shows selected entities count and list */}
        <SelectionInfo />
      </ReactFlowProvider>
    </div>
  );
}
