/**
 * Tests for useSettlementLayers hook
 *
 * Tests settlement data fetching and layer rendering on the map
 */

import { renderHook, waitFor } from '@testing-library/react';
import { type Map as MaplibreMap } from 'maplibre-gl';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as api from '@/services/api/hooks';

import * as mapLayersModule from './useMapLayers';
import { useSettlementLayers } from './useSettlementLayers';

// Mock modules
vi.mock('@/services/api/hooks', () => ({
  useSettlementsForMap: vi.fn(),
}));

vi.mock('./useMapLayers', () => ({
  useMapLayers: vi.fn(),
}));

describe('useSettlementLayers', () => {
  const mockMap = {} as MaplibreMap;
  const mockKingdomId = 'test-kingdom-id';

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

  it('should not fetch settlements when disabled', () => {
    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: [],
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, false));

    // Should skip query
    expect(mockUseSettlementsForMap).toHaveBeenCalledWith(mockKingdomId, { skip: true });
  });

  it('should fetch settlements when enabled', () => {
    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: [],
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    // Should fetch
    expect(mockUseSettlementsForMap).toHaveBeenCalledWith(mockKingdomId, { skip: false });
  });

  it('should not render layers when loading', () => {
    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: [],
      loading: true,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 1,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    // Should not call addDataLayer while loading
    expect(mockAddDataLayer).not.toHaveBeenCalled();
  });

  it('should not render layers when error occurs', () => {
    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: [],
      loading: false,
      error: new Error('Test error') as never,
      refetch: vi.fn() as never,
      networkStatus: 8,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    // Should not call addDataLayer on error
    expect(mockAddDataLayer).not.toHaveBeenCalled();
  });

  it('should render settlements with valid location geometry', async () => {
    const mockSettlements = [
      {
        id: 'settlement-1',
        name: 'Test Settlement',
        level: 3,
        location: {
          id: 'loc-1',
          worldId: 'world-1',
          type: 'point',
          name: 'Settlement Location',
          description: null,
          geojson: {
            type: 'Point',
            coordinates: [15.5, 25.3],
          },
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        archivedAt: null,
      },
    ];

    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: mockSettlements as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    await waitFor(() => {
      expect(mockAddDataLayer).toHaveBeenCalledWith('settlement', {
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [15.5, 25.3],
            },
            properties: expect.objectContaining({
              id: 'settlement-1',
              type: 'settlement',
              name: 'Test Settlement',
              level: 3,
              locationId: 'loc-1',
            }),
          }),
        ]),
      });
    });
  });

  it('should handle settlements without location gracefully', async () => {
    const mockSettlements = [
      {
        id: 'settlement-1',
        name: 'Settlement With Location',
        level: 2,
        location: {
          id: 'loc-1',
          worldId: 'world-1',
          type: 'point',
          name: 'Location 1',
          description: null,
          geojson: {
            type: 'Point',
            coordinates: [10, 20],
          },
        },
      },
      {
        id: 'settlement-2',
        name: 'Settlement Without Location',
        level: 1,
        location: null, // No location
      },
    ];

    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: mockSettlements as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    await waitFor(() => {
      // Only settlement with valid location should be rendered
      expect(mockAddDataLayer).toHaveBeenCalledWith('settlement', {
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            properties: expect.objectContaining({
              id: 'settlement-1',
            }),
          }),
        ]),
      });

      // Should have exactly 1 feature (settlement-2 filtered out)
      const callArgs = mockAddDataLayer.mock.calls[0];
      expect(callArgs[1].features).toHaveLength(1);
    });
  });

  it('should handle invalid geometry coordinates', async () => {
    const mockSettlements = [
      {
        id: 'settlement-1',
        name: 'Valid Settlement',
        level: 2,
        location: {
          id: 'loc-1',
          worldId: 'world-1',
          type: 'point',
          name: 'Valid Location',
          description: null,
          geojson: {
            type: 'Point',
            coordinates: [10, 20],
          },
        },
      },
      {
        id: 'settlement-2',
        name: 'Invalid Coordinates',
        level: 1,
        location: {
          id: 'loc-2',
          worldId: 'world-1',
          type: 'point',
          name: 'Invalid Location',
          description: null,
          geojson: {
            type: 'Point',
            coordinates: [NaN, 20], // Invalid coordinate
          },
        },
      },
    ];

    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: mockSettlements as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    await waitFor(() => {
      // Only settlement with valid coordinates should be rendered
      const callArgs = mockAddDataLayer.mock.calls[0];
      expect(callArgs[1].features).toHaveLength(1);
      expect(callArgs[1].features[0].properties.id).toBe('settlement-1');
    });
  });

  it('should return loading state', () => {
    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: [],
      loading: true,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 1,
    });

    const { result } = renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeUndefined();
    expect(result.current.settlementCount).toBe(0);
  });

  it('should return error state', () => {
    const testError = new Error('Test error');
    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: [],
      loading: false,
      error: testError as never,
      refetch: vi.fn() as never,
      networkStatus: 8,
    });

    const { result } = renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(testError);
    expect(result.current.settlementCount).toBe(0);
  });

  it('should return settlement count', () => {
    const mockSettlements = [
      {
        id: 'settlement-1',
        name: 'Settlement 1',
        level: 1,
        location: {
          id: 'loc-1',
          geojson: { type: 'Point', coordinates: [10, 20] },
        },
      },
      {
        id: 'settlement-2',
        name: 'Settlement 2',
        level: 2,
        location: {
          id: 'loc-2',
          geojson: { type: 'Point', coordinates: [15, 25] },
        },
      },
    ];

    const mockUseSettlementsForMap = vi.spyOn(api, 'useSettlementsForMap');
    mockUseSettlementsForMap.mockReturnValue({
      settlements: mockSettlements as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    const { result } = renderHook(() => useSettlementLayers(mockMap, mockKingdomId, true));

    expect(result.current.settlementCount).toBe(2);
  });
});
