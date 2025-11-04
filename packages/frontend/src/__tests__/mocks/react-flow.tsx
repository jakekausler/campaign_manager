import type { ReactNode } from 'react';
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
 * Full mock module export
 * Use this to replace the entire @xyflow/react module in tests
 */
export const createReactFlowMock = () => ({
  ReactFlow: mockReactFlow,
  ReactFlowProvider: mockReactFlowProvider,
  useReactFlow: mockUseReactFlow,
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
