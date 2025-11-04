import type { ReactNode } from 'react';
import { useState } from 'react';
import { vi } from 'vitest';

/**
 * Mock implementations of React Flow components for unit testing
 *
 * These mocks reduce memory usage by replacing heavy React Flow components
 * with lightweight versions that preserve the component API but don't
 * instantiate the full React Flow rendering engine.
 *
 * Use in tests with:
 * ```typescript
 * vi.mock('@xyflow/react', () => ({
 *   ...vi.importActual('@xyflow/react'),
 *   ReactFlow: mockReactFlow,
 *   ReactFlowProvider: mockReactFlowProvider,
 * }));
 * ```
 *
 * Related: Phase 5 of test-performance-optimization-plan.md
 */

interface ReactFlowNode {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  selected?: boolean;
  [key: string]: unknown;
}

interface ReactFlowProps {
  children?: ReactNode;
  nodes?: ReactFlowNode[];
  edges?: unknown[];
  nodeTypes?: Record<
    string,
    React.ComponentType<{ data: Record<string, unknown>; selected: boolean }>
  >;
  onNodesChange?: (...args: unknown[]) => void;
  onEdgesChange?: (...args: unknown[]) => void;
  onConnect?: (...args: unknown[]) => void;
  onNodeClick?: (event: React.MouseEvent, node: ReactFlowNode) => void;
  onNodeDoubleClick?: (...args: unknown[]) => void;
  onPaneClick?: (...args: unknown[]) => void;
  fitView?: boolean;
  [key: string]: unknown;
}

interface ReactFlowProviderProps {
  children?: ReactNode;
}

/**
 * Lightweight mock of ReactFlow component
 * Renders a simple div with test-id for querying in tests
 *
 * Enhanced to render node content using custom node types so that
 * tests can query for node content (branch names, descriptions, etc.)
 */
export const mockReactFlow = ({
  children,
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  _onNodesChange,
  _onEdgesChange,
  _onConnect,
  _onNodeDoubleClick,
  _onPaneClick,
  _fitView,
  _minZoom,
  _maxZoom,
  _defaultEdgeOptions,
  ...restProps
}: ReactFlowProps) => (
  <div
    data-testid="react-flow-mock"
    data-nodes-count={nodes?.length ?? 0}
    data-edges-count={edges?.length ?? 0}
    className="react-flow"
    {...restProps}
  >
    {/* Render nodes using custom node types if provided */}
    {nodes?.map((node) => {
      const NodeComponent = nodeTypes?.[node.type || 'default'];
      if (NodeComponent) {
        return (
          <div
            key={node.id}
            data-testid={`flow-node-${node.id}`}
            onClick={(e) => onNodeClick?.(e, node)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNodeClick?.(e as unknown as React.MouseEvent, node);
              }
            }}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <NodeComponent data={node.data} selected={node.selected || false} />
          </div>
        );
      }
      // Fallback: render node data as JSON
      return (
        <div key={node.id} data-testid={`flow-node-${node.id}`}>
          {JSON.stringify(node.data)}
        </div>
      );
    })}
    {children}
  </div>
);

/**
 * Lightweight mock of ReactFlowProvider
 * Simply renders children without providing React Flow context
 */
export const mockReactFlowProvider = ({ children }: ReactFlowProviderProps) => (
  <div data-testid="react-flow-provider-mock">{children}</div>
);

/**
 * Mock useReactFlow hook
 * Returns minimal mock implementation of React Flow instance methods
 */
export const mockUseReactFlow = () => ({
  getNodes: vi.fn(() => []),
  getEdges: vi.fn(() => []),
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  getNode: vi.fn(),
  getEdge: vi.fn(),
  setCenter: vi.fn(),
  fitView: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  getZoom: vi.fn(() => 1.0),
  setViewport: vi.fn(),
  getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  screenToFlowPosition: vi.fn((pos) => pos),
  flowToScreenPosition: vi.fn((pos) => pos),
  project: vi.fn((pos) => pos),
});

/**
 * Mock useNodesState hook
 * Mimics React Flow's useNodesState which manages nodes state
 * Returns a tuple [nodes, setNodes, onNodesChange] like the real hook
 *
 * Note: This is a mock hook that wraps useState, so ESLint warnings are suppressed
 */
// eslint-disable-next-line react-hooks/rules-of-hooks
export const mockUseNodesState = (initialNodes: unknown[] = []) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [nodes, setNodes] = useState(initialNodes);
  const onNodesChange = vi.fn((_changes: unknown[]) => {
    // Simplified change handler - in real hook this applies changes
    // For tests, we just call setNodes with current state
    setNodes((prevNodes) => prevNodes);
  });
  return [nodes, setNodes, onNodesChange] as const;
};

/**
 * Mock useEdgesState hook
 * Mimics React Flow's useEdgesState which manages edges state
 * Returns a tuple [edges, setEdges, onEdgesChange] like the real hook
 *
 * Note: This is a mock hook that wraps useState, so ESLint warnings are suppressed
 */
// eslint-disable-next-line react-hooks/rules-of-hooks
export const mockUseEdgesState = (initialEdges: unknown[] = []) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [edges, setEdges] = useState(initialEdges);
  const onEdgesChange = vi.fn((_changes: unknown[]) => {
    // Simplified change handler - in real hook this applies changes
    // For tests, we just call setEdges with current state
    setEdges((prevEdges) => prevEdges);
  });
  return [edges, setEdges, onEdgesChange] as const;
};

/**
 * Mock Position enum from React Flow
 * Used for edge positioning (Top, Right, Bottom, Left)
 */
export enum Position {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left',
}

/**
 * Mock getSmoothStepPath function
 * Returns a simple SVG path string for testing
 */
export const mockGetSmoothStepPath = (params: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  [key: string]: unknown;
}) => {
  // Simple linear path for testing
  return [`M ${params.sourceX},${params.sourceY} L ${params.targetX},${params.targetY}`, 0, 0];
};

/**
 * Mock BaseEdge component
 * Renders a simple path element for testing
 */
export const mockBaseEdge = ({ path, ...props }: { path: string; [key: string]: unknown }) => (
  <path d={path} className="react-flow__edge-path" {...props} />
);

/**
 * Mock EdgeLabelRenderer component
 * Renders children in a div for testing
 */
export const mockEdgeLabelRenderer = ({ children }: { children?: ReactNode }) => (
  <div className="react-flow__edge-label-renderer">{children}</div>
);

/**
 * Mock Handle component
 * Renders a simple div for node connection handles
 */
export const mockHandle = ({
  type,
  position,
  ...props
}: {
  type: string;
  position: Position;
  [key: string]: unknown;
}) => (
  <div
    data-testid={`handle-${type}-${position}`}
    className={`react-flow__handle react-flow__handle-${type} react-flow__handle-${position}`}
    {...props}
  />
);

/**
 * Full mock module export
 * Use this to replace the entire @xyflow/react module in tests
 */
export const createReactFlowMock = () => ({
  ReactFlow: mockReactFlow,
  ReactFlowProvider: mockReactFlowProvider,
  useReactFlow: mockUseReactFlow,
  useNodesState: mockUseNodesState,
  useEdgesState: mockUseEdgesState,
  Position,
  getSmoothStepPath: mockGetSmoothStepPath,
  BaseEdge: mockBaseEdge,
  EdgeLabelRenderer: mockEdgeLabelRenderer,
  Handle: mockHandle,
  // Re-export commonly used types/utilities if needed
  MiniMap: ({ children }: { children?: ReactNode }) => (
    <div data-testid="minimap-mock" className="react-flow__minimap">
      {children}
    </div>
  ),
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="controls-mock" className="react-flow__controls">
      {children}
    </div>
  ),
  Background: () => <div data-testid="background-mock" className="react-flow__background" />,
  Panel: ({ children }: { children?: ReactNode }) => <div data-testid="panel-mock">{children}</div>,
});
