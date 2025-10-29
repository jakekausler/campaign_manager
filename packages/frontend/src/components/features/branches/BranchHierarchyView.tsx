import type { Edge, Node, NodeMouseHandler } from '@xyflow/react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import * as dagre from 'dagre';
import { Calendar, Edit2, GitBranch, GitFork, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGetBranchHierarchy, useDeleteBranch } from '@/services/api/hooks/branches';
import { useCampaignStore } from '@/stores';

import { DeleteBranchDialog, type BranchInfo } from './DeleteBranchDialog';
import { RenameBranchDialog } from './RenameBranchDialog';

// Types for branch data
type BranchNodeType = {
  branch: {
    id: string;
    name: string;
    description?: string | null;
    campaignId: string;
    parentId?: string | null;
    divergedAt?: string | null;
    isPinned: boolean;
    color?: string | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
  };
  children: BranchNodeType[];
};

// Node data for React Flow
type BranchFlowNodeData = {
  branchId: string;
  name: string;
  description?: string | null;
  divergedAt?: string | null;
  createdAt: string;
  isCurrent: boolean;
  parentId?: string | null;
  childrenIds: string[];
  versionCount?: number; // TODO: Add when backend provides statistics
  onDelete?: (branchId: string) => void;
  onRename?: (branchId: string) => void;
};

/**
 * Custom node component for displaying branch information in the hierarchy.
 *
 * Shows branch name, metadata, and provides action buttons on hover.
 */
function BranchNode({ data, selected }: { data: BranchFlowNodeData; selected: boolean }) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={`relative rounded-lg border-2 bg-white p-4 shadow-md transition-all ${
        data.isCurrent ? 'border-primary' : selected ? 'border-blue-400' : 'border-gray-300'
      } min-w-[200px] max-w-[280px]`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      role="article"
      aria-label={`Branch: ${data.name}${data.isCurrent ? ' (current)' : ''}`}
    >
      {/* Branch icon and name */}
      <div className="mb-2 flex items-center gap-2">
        <GitBranch className={`h-5 w-5 ${data.isCurrent ? 'text-primary' : 'text-gray-600'}`} />
        <h3 className="flex-1 truncate font-semibold text-sm">{data.name}</h3>
      </div>

      {/* Metadata */}
      {data.description && (
        <p className="mb-2 line-clamp-2 text-xs text-gray-600">{data.description}</p>
      )}
      <div className="space-y-1 text-xs text-gray-500">
        {data.divergedAt && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Diverged: {new Date(data.divergedAt).toLocaleDateString()}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span>Created: {new Date(data.createdAt).toLocaleDateString()}</span>
        </div>
        {data.versionCount !== undefined && (
          <div className="flex items-center gap-1">
            <span>{data.versionCount} versions</span>
          </div>
        )}
      </div>

      {/* Current branch indicator */}
      {data.isCurrent && (
        <div className="absolute -top-2 -right-2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
          Current
        </div>
      )}

      {/* Action buttons on hover */}
      {showActions && (
        <div className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Fork this branch (coming in future stage)"
            aria-label="Fork this branch"
            disabled
          >
            <GitFork className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            title="Rename branch"
            aria-label="Rename branch"
            onClick={(e) => {
              e.stopPropagation();
              data.onRename?.(data.branchId);
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-destructive"
            title="Delete branch"
            aria-label="Delete branch"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(data.branchId);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Register custom node types
const nodeTypes = {
  branchNode: BranchNode,
};

/**
 * Converts branch hierarchy data to React Flow nodes and edges.
 *
 * Recursively walks the branch tree and creates nodes for each branch
 * and edges connecting parents to children.
 */
function convertHierarchyToFlow(
  hierarchy: BranchNodeType[],
  currentBranchId?: string,
  onDelete?: (branchId: string) => void,
  onRename?: (branchId: string) => void
): { nodes: Node<BranchFlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<BranchFlowNodeData>[] = [];
  const edges: Edge[] = [];

  function processNode(branchNode: BranchNodeType) {
    const { branch, children } = branchNode;

    // Create node
    nodes.push({
      id: branch.id,
      type: 'branchNode',
      position: { x: 0, y: 0 }, // Will be positioned by layout algorithm
      data: {
        branchId: branch.id,
        name: branch.name,
        description: branch.description,
        divergedAt: branch.divergedAt,
        createdAt: branch.createdAt,
        isCurrent: branch.id === currentBranchId,
        parentId: branch.parentId,
        childrenIds: children.map((c) => c.branch.id),
        onDelete,
        onRename,
      },
    });

    // Create edges to children
    for (const child of children) {
      edges.push({
        id: `${branch.id}-${child.branch.id}`,
        source: branch.id,
        target: child.branch.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      });

      // Recursively process child
      processNode(child);
    }
  }

  // Process all root nodes
  for (const rootNode of hierarchy) {
    processNode(rootNode);
  }

  return { nodes, edges };
}

/**
 * Applies hierarchical layout to nodes using dagre.
 *
 * Positions nodes in a top-down tree layout with automatic spacing.
 */
function applyHierarchicalLayout(
  nodes: Node<BranchFlowNodeData>[],
  edges: Edge[]
): Node<BranchFlowNodeData>[] {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 });

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 280, height: 120 });
  });

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply positions to nodes
  return nodes.map((node) => {
    const position = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - 140, // Center the node (width / 2)
        y: position.y - 60, // Center the node (height / 2)
      },
    };
  });
}

/**
 * Branch Hierarchy View Component
 *
 * Displays the branch hierarchy as an interactive tree diagram using React Flow.
 * Users can:
 * - View all branches in hierarchical structure
 * - See current branch highlighted
 * - Click branches to switch context
 * - Hover for actions (fork, rename, delete)
 * - Pan, zoom, and navigate the tree
 * - Search/filter branches
 */
export function BranchHierarchyView() {
  const { currentCampaignId, currentBranchId, setCurrentBranch } = useCampaignStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [branchToDelete, setBranchToDelete] = useState<BranchInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToRename, setBranchToRename] = useState<BranchNodeType['branch'] | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);

  // Fetch branch hierarchy
  const { data, loading, error, refetch } = useGetBranchHierarchy({
    variables: { campaignId: currentCampaignId || '' },
    skip: !currentCampaignId,
  });

  // Delete branch mutation
  const [deleteBranch, { loading: deleting }] = useDeleteBranch();

  // Handle delete button click
  const handleDeleteClick = useCallback(
    (branchId: string) => {
      if (!data?.branchHierarchy) return;

      // Find branch in hierarchy
      const findBranch = (nodes: BranchNodeType[]): BranchNodeType | null => {
        for (const node of nodes) {
          if (node.branch.id === branchId) return node;
          const found = findBranch(node.children);
          if (found) return found;
        }
        return null;
      };

      const branchNode = findBranch(data.branchHierarchy);
      if (branchNode) {
        setBranchToDelete({
          id: branchNode.branch.id,
          name: branchNode.branch.name,
          parentId: branchNode.branch.parentId,
          children: branchNode.children.map((c) => ({ id: c.branch.id })),
        });
        setDeleteDialogOpen(true);
      }
    },
    [data]
  );

  // Handle rename button click
  const handleRenameClick = useCallback(
    (branchId: string) => {
      if (!data?.branchHierarchy) return;

      // Find branch in hierarchy
      const findBranch = (nodes: BranchNodeType[]): BranchNodeType | null => {
        for (const node of nodes) {
          if (node.branch.id === branchId) return node;
          const found = findBranch(node.children);
          if (found) return found;
        }
        return null;
      };

      const branchNode = findBranch(data.branchHierarchy);
      if (branchNode) {
        setBranchToRename(branchNode.branch);
        setRenameDialogOpen(true);
      }
    },
    [data]
  );

  // Handle rename success
  const handleRenameSuccess = useCallback(() => {
    toast.success('Branch renamed', {
      description: `Branch has been successfully renamed.`,
    });

    // Close dialog and refetch hierarchy
    setRenameDialogOpen(false);
    setBranchToRename(null);
    refetch();
  }, [refetch]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!branchToDelete) return;

    try {
      await deleteBranch({
        variables: { id: branchToDelete.id },
      });

      toast.success('Branch deleted', {
        description: `"${branchToDelete.name}" has been permanently deleted.`,
      });

      // If deleted branch was current, switch to parent
      if (branchToDelete.id === currentBranchId && branchToDelete.parentId) {
        setCurrentBranch(branchToDelete.parentId);
      }

      // Close dialog and refetch hierarchy
      setDeleteDialogOpen(false);
      setBranchToDelete(null);
      refetch();
    } catch (err) {
      toast.error('Failed to delete branch', {
        description: err instanceof Error ? err.message : 'An unknown error occurred',
      });
    }
  }, [branchToDelete, deleteBranch, currentBranchId, setCurrentBranch, refetch]);

  // Convert hierarchy to flow nodes/edges
  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    if (!data?.branchHierarchy) {
      return { nodes: [], edges: [] };
    }
    return convertHierarchyToFlow(
      data.branchHierarchy,
      currentBranchId ?? undefined,
      handleDeleteClick,
      handleRenameClick
    );
  }, [data, currentBranchId, handleDeleteClick, handleRenameClick]);

  // Apply layout
  const layoutedNodes = useMemo(() => {
    if (rawNodes.length === 0) return [];
    return applyHierarchicalLayout(rawNodes, rawEdges);
  }, [rawNodes, rawEdges]);

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return layoutedNodes;
    const query = searchQuery.toLowerCase();
    return layoutedNodes.filter(
      (node) =>
        node.data.name.toLowerCase().includes(query) ||
        node.data.description?.toLowerCase().includes(query)
    );
  }, [layoutedNodes, searchQuery]);

  // Filter edges to only show connections between visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return rawEdges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [filteredNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(filteredNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(filteredEdges);

  // Update nodes and edges when filtered data changes
  useEffect(() => {
    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [filteredNodes, filteredEdges, setNodes, setEdges]);

  // Handle node click - switch to selected branch
  const onNodeClick: NodeMouseHandler<Node<BranchFlowNodeData>> = useCallback(
    (_event, node) => {
      if (node.data.branchId !== currentBranchId) {
        setCurrentBranch(node.data.branchId);
      }
    },
    [currentBranchId, setCurrentBranch]
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div
            className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary mx-auto"
            role="status"
          />
          <p className="text-sm text-gray-600">Loading branch hierarchy...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-2 text-sm text-red-600">Failed to load branch hierarchy</p>
          <Button onClick={() => refetch()} size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0 && !searchQuery) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <GitBranch className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <p className="mb-1 text-sm font-medium text-gray-900">No branches found</p>
          <p className="text-sm text-gray-600">Create your first branch to get started</p>
        </div>
      </div>
    );
  }

  // No search results
  if (nodes.length === 0 && searchQuery) {
    return (
      <div className="flex h-full flex-col">
        {/* Search bar */}
        <div className="border-b border-gray-200 p-4">
          <Input
            type="text"
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Empty search results */}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="mb-1 text-sm font-medium text-gray-900">No branches match your search</p>
            <p className="text-sm text-gray-600">Try a different search term</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <label htmlFor="branch-search" className="sr-only">
            Search branches
          </label>
          <Input
            id="branch-search"
            type="text"
            placeholder="Search branches..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
            aria-label="Search branches by name or description"
          />
          <div className="text-sm text-gray-600" aria-live="polite">
            {filteredNodes.length} {filteredNodes.length === 1 ? 'branch' : 'branches'}
          </div>
        </div>
      </div>

      {/* React Flow visualization */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: false,
          }}
        >
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as BranchFlowNodeData;
              return data.isCurrent ? '#3b82f6' : '#e5e7eb';
            }}
          />
        </ReactFlow>
      </div>

      {/* Fork dialog - TODO: Implement when BranchSelector provides sourceBranch prop */}
      {/* ForkBranchDialog requires sourceBranch: Branch | null prop */}
      {/* Will be implemented in future ticket when BranchSelector integration is complete */}

      {/* Rename Branch Dialog */}
      <RenameBranchDialog
        branch={branchToRename}
        isOpen={renameDialogOpen}
        onClose={() => {
          setRenameDialogOpen(false);
          setBranchToRename(null);
        }}
        onSuccess={handleRenameSuccess}
      />

      {/* Delete Branch Dialog */}
      <DeleteBranchDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setBranchToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        branch={branchToDelete}
        loading={deleting}
        isCurrentBranch={branchToDelete?.id === currentBranchId}
      />
    </div>
  );
}

/**
 * Wrapper component that provides ReactFlowProvider context.
 *
 * ReactFlow requires a provider to manage internal state.
 */
export function BranchHierarchyViewWrapper() {
  return (
    <ReactFlowProvider>
      <BranchHierarchyView />
    </ReactFlowProvider>
  );
}
