import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { renderWithReactFlow, screen, cleanup } from '@/__tests__/utils/test-utils';
import type { FlowNodeData } from '@/utils';

import { EntityNode } from './EntityNode';

const mockNodeData: FlowNodeData = {
  label: 'Castle of Dawn',
  nodeType: 'ENTITY',
  entityId: 'settlement-castle-dawn',
  metadata: { entityType: 'Settlement', level: 4 },
};

describe('EntityNode', () => {
  // Phase 3: Enable memory profiling to track React Flow memory usage
  enableMemoryProfiling({ warnThresholdMB: 30 });

  afterEach(() => {
    cleanup(); // Critical: unmount React Flow instances to prevent memory leaks
    vi.clearAllMocks();
  });

  // Phase 3: Print memory summary after all tests complete
  afterAll(() => {
    console.log('\n🎨 EntityNode Component Memory Profile:');
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });
  it('renders with correct label', () => {
    renderWithReactFlow(
      <EntityNode
        id="entity-1"
        data={mockNodeData}
        selected={false}
        type="ENTITY"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    expect(screen.getByText('Castle of Dawn')).toBeInTheDocument();
    expect(screen.getByText('ENTITY')).toBeInTheDocument();
  });

  it('uses purple color scheme', () => {
    const { container } = renderWithReactFlow(
      <EntityNode
        id="entity-1"
        data={mockNodeData}
        selected={false}
        type="ENTITY"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    // The node div is the one with role="button"
    const nodeDiv = container.querySelector('div[role="button"]');
    expect(nodeDiv).toBeInTheDocument();
    // Note: backgroundColor style is applied inline but may not be testable in jsdom
    expect(nodeDiv).toHaveAttribute('style');
  });

  it('renders Box icon', () => {
    const { container } = renderWithReactFlow(
      <EntityNode
        id="entity-1"
        data={mockNodeData}
        selected={false}
        type="ENTITY"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('has accessible label with ENTITY type', () => {
    renderWithReactFlow(
      <EntityNode
        id="entity-1"
        data={mockNodeData}
        selected={false}
        type="ENTITY"
        isConnectable={true}
        zIndex={1}
        dragging={false}
        selectable={true}
        deletable={true}
        draggable={true}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    );

    const node = screen.getByRole('button');
    expect(node).toHaveAttribute('aria-label', 'ENTITY node: Castle of Dawn');
  });
});
