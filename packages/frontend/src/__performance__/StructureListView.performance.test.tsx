import { NetworkStatus } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing/react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock GraphQL hooks
vi.mock('@/services/api/hooks/structures', () => ({
  useStructuresForMap: vi.fn(),
}));

vi.mock('@/services/api/mutations/structures', () => ({
  useDeleteStructure: vi.fn(() => ({
    deleteStructure: vi.fn(),
    loading: false,
  })),
}));

import { useStructuresForMap } from '@/services/api/hooks/structures';

import { StructureListView } from '../components/features/entity-inspector/StructureListView';

const mockedUseStructuresForMap = vi.mocked(useStructuresForMap);

// Helper to generate mock structures
const generateMockStructures = (count: number) => {
  const types = [
    'temple',
    'barracks',
    'market',
    'library',
    'forge',
    'tavern',
    'fortress',
    'citadel',
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `structure-${i}`,
    name: `Structure ${i}`,
    type: types[i % types.length],
    typeId: `type-${i % types.length}`,
    level: (i % 10) + 1,
    settlementId: 'settlement-1',
    x: i * 10,
    y: i * 5,
    orientation: (i * 45) % 360,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
  }));
};

describe('StructureListView - Performance', () => {
  it('should render 50 structures in less than 100ms', () => {
    const structures = generateMockStructures(50);
    mockedUseStructuresForMap.mockReturnValue({
      structures,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: NetworkStatus.ready,
    });

    const start = performance.now();

    render(
      <MockedProvider>
        <StructureListView settlementId="settlement-1" />
      </MockedProvider>
    );

    const end = performance.now();
    const renderTime = end - start;

    console.log(`Render time for 50 structures: ${renderTime.toFixed(2)}ms`);
    expect(renderTime).toBeLessThan(100);
  });

  it('should render 100 structures in less than 200ms', () => {
    const structures = generateMockStructures(100);
    mockedUseStructuresForMap.mockReturnValue({
      structures,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: NetworkStatus.ready,
    });

    const start = performance.now();

    render(
      <MockedProvider>
        <StructureListView settlementId="settlement-1" />
      </MockedProvider>
    );

    const end = performance.now();
    const renderTime = end - start;

    console.log(`Render time for 100 structures: ${renderTime.toFixed(2)}ms`);
    expect(renderTime).toBeLessThan(200);
  });

  it('should render 200 structures in less than 500ms', () => {
    const structures = generateMockStructures(200);
    mockedUseStructuresForMap.mockReturnValue({
      structures,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: NetworkStatus.ready,
    });

    const start = performance.now();

    render(
      <MockedProvider>
        <StructureListView settlementId="settlement-1" />
      </MockedProvider>
    );

    const end = performance.now();
    const renderTime = end - start;

    console.log(`Render time for 200 structures: ${renderTime.toFixed(2)}ms`);
    expect(renderTime).toBeLessThan(500);
  });

  it('should enable virtual scrolling for 50+ structures', () => {
    const structures = generateMockStructures(50);
    mockedUseStructuresForMap.mockReturnValue({
      structures,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: NetworkStatus.ready,
    });

    const { container } = render(
      <MockedProvider>
        <StructureListView settlementId="settlement-1" />
      </MockedProvider>
    );

    // Virtual scrolling container should have fixed height when enabled
    const scrollContainer = container.querySelector('[style*="height: 400px"]');
    expect(scrollContainer).toBeTruthy();
  });

  it('should not enable virtual scrolling for fewer than 50 structures', () => {
    const structures = generateMockStructures(30);
    mockedUseStructuresForMap.mockReturnValue({
      structures,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
      networkStatus: NetworkStatus.ready,
    });

    const { container } = render(
      <MockedProvider>
        <StructureListView settlementId="settlement-1" />
      </MockedProvider>
    );

    // Virtual scrolling container should NOT have fixed height when disabled
    const scrollContainer = container.querySelector('[style*="height: 400px"]');
    expect(scrollContainer).toBeFalsy();
  });
});
