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

interface ReactFlowProps {
  children?: ReactNode;
  nodes?: unknown[];
  edges?: unknown[];
  onNodesChange?: (...args: unknown[]) => void;
  onEdgesChange?: (...args: unknown[]) => void;
  onConnect?: (...args: unknown[]) => void;
  onNodeClick?: (...args: unknown[]) => void;
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
 */
export const mockReactFlow = ({ children, nodes, edges, ...props }: ReactFlowProps) => (
  <div
    data-testid="react-flow-mock"
    data-nodes-count={nodes?.length ?? 0}
    data-edges-count={edges?.length ?? 0}
    {...props}
  >
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
 * Full mock module export
 * Use this to replace the entire @xyflow/react module in tests
 */
export const createReactFlowMock = () => ({
  ReactFlow: mockReactFlow,
  ReactFlowProvider: mockReactFlowProvider,
  useReactFlow: mockUseReactFlow,
  useNodesState: mockUseNodesState,
  useEdgesState: mockUseEdgesState,
  // Re-export commonly used types/utilities if needed
  MiniMap: ({ children }: { children?: ReactNode }) => (
    <div data-testid="minimap-mock">{children}</div>
  ),
  Controls: ({ children }: { children?: ReactNode }) => (
    <div data-testid="controls-mock">{children}</div>
  ),
  Background: () => <div data-testid="background-mock" />,
  Panel: ({ children }: { children?: ReactNode }) => <div data-testid="panel-mock">{children}</div>,
});
