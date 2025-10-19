/**
 * Tests for useStructureLayers hook
 *
 * Tests structure data fetching and layer rendering on the map
 */

import { renderHook } from '@testing-library/react';
import { type Map as MaplibreMap } from 'maplibre-gl';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as api from '@/services/api/hooks';

import * as mapLayersModule from './useMapLayers';
import { useStructureLayers } from './useStructureLayers';

// Mock modules
vi.mock('@/services/api/hooks', () => ({
  useStructuresForMap: vi.fn(),
}));

vi.mock('./useMapLayers', () => ({
  useMapLayers: vi.fn(),
}));

describe('useStructureLayers', () => {
  const mockMap = {} as MaplibreMap;
  const mockSettlementId = 'test-settlement-id';

  const mockAddDataLayer = vi.fn();
  const mockUpdateDataLayer = vi.fn();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock useMapLayers
    vi.spyOn(mapLayersModule, 'useMapLayers').mockReturnValue({
      addDataLayer: mockAddDataLayer,
      updateDataLayer: mockUpdateDataLayer,
      addSource: vi.fn(),
      updateSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      toggleLayerVisibility: vi.fn(),
      setLayerVisible: vi.fn(),
      layerVisibility: {
        'location-point': true,
        'location-region': true,
        settlement: true,
        structure: true,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not fetch structures when disabled', () => {
    const mockUseStructuresForMap = vi.spyOn(api, 'useStructuresForMap');
    mockUseStructuresForMap.mockReturnValue({
      structures: [],
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useStructureLayers(mockMap, mockSettlementId, false));

    // Should skip query
    expect(mockUseStructuresForMap).toHaveBeenCalledWith(mockSettlementId, { skip: true });
  });

  it('should fetch structures when enabled', () => {
    const mockUseStructuresForMap = vi.spyOn(api, 'useStructuresForMap');
    mockUseStructuresForMap.mockReturnValue({
      structures: [],
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useStructureLayers(mockMap, mockSettlementId, true));

    // Should fetch
    expect(mockUseStructuresForMap).toHaveBeenCalledWith(mockSettlementId, { skip: false });
  });

  it('should return loading state', () => {
    const mockUseStructuresForMap = vi.spyOn(api, 'useStructuresForMap');
    mockUseStructuresForMap.mockReturnValue({
      structures: [],
      loading: true,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 1,
    });

    const { result } = renderHook(() => useStructureLayers(mockMap, mockSettlementId));

    expect(result.current.loading).toBe(true);
    expect(result.current.structureCount).toBe(0);
  });

  it('should return error state', () => {
    const mockError = new Error('Test error');
    const mockUseStructuresForMap = vi.spyOn(api, 'useStructuresForMap');
    mockUseStructuresForMap.mockReturnValue({
      structures: [],
      loading: false,
      error: mockError as never,
      refetch: vi.fn() as never,
      networkStatus: 8,
    });

    const { result } = renderHook(() => useStructureLayers(mockMap, mockSettlementId));

    expect(result.current.error).toBe(mockError);
    expect(result.current.structureCount).toBe(0);
  });

  it('should return structure count', () => {
    const mockStructures = [
      {
        id: '1',
        name: 'Temple',
        type: 'temple',
        level: 1,
        settlementId: mockSettlementId,
        settlement: {
          id: mockSettlementId,
          name: 'Test Settlement',
          level: 1,
          location: {
            id: 'loc-1',
            geojson: { coordinates: [0, 0] },
          },
        },
      },
      {
        id: '2',
        name: 'Barracks',
        type: 'barracks',
        level: 2,
        settlementId: mockSettlementId,
        settlement: {
          id: mockSettlementId,
          name: 'Test Settlement',
          level: 1,
          location: {
            id: 'loc-1',
            geojson: { coordinates: [0, 0] },
          },
        },
      },
    ];

    const mockUseStructuresForMap = vi.spyOn(api, 'useStructuresForMap');
    mockUseStructuresForMap.mockReturnValue({
      structures: mockStructures as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    const { result } = renderHook(() => useStructureLayers(mockMap, mockSettlementId));

    expect(result.current.structureCount).toBe(2);
  });
});
