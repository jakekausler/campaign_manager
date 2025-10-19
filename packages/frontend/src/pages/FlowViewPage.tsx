import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';

import {
  VariableNode,
  ConditionNode,
  EffectNode,
  EntityNode,
  ReadsEdge,
  WritesEdge,
  DependsOnEdge,
} from '@/components/features/flow';
import { useDependencyGraph } from '@/services/api/hooks';
import { useCurrentCampaignId } from '@/stores';
import { transformGraphToFlow } from '@/utils';
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

  // Fetch dependency graph for the current campaign
  const { graph, loading, error } = useDependencyGraph(campaignId || '');

  // Transform graph data to React Flow format with auto-layout
  // Must be called before any conditional returns (React Hooks rules)
  const { nodes, edges } = useMemo(
    () => (graph ? transformGraphToFlow(graph) : { nodes: [], edges: [] }),
    [graph]
  );

  // Show loading state
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading dependency graph...</div>
          <div className="text-sm text-muted-foreground mt-2">
            Building visualization of campaign relationships
          </div>
        </div>
      </div>
    );
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
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-background"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

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
