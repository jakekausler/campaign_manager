/**
 * Tests for useLocationLayers hook
 *
 * Tests location data fetching and layer rendering on the map
 */

import { renderHook, waitFor } from '@testing-library/react';
import { type Map as MaplibreMap } from 'maplibre-gl';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import * as api from '@/services/api/hooks';

import { useLocationLayers } from './useLocationLayers';
import * as mapLayersModule from './useMapLayers';

// Mock modules
vi.mock('@/services/api/hooks', () => ({
  useLocationsByWorld: vi.fn(),
}));

vi.mock('./useMapLayers', () => ({
  useMapLayers: vi.fn(),
}));

describe('useLocationLayers', () => {
  const mockMap = {} as MaplibreMap;
  const mockWorldId = 'test-world-id';

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

  it('should not fetch locations when disabled', () => {
    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: [],
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, false));

    // Should skip query
    expect(mockUseLocationsByWorld).toHaveBeenCalledWith(mockWorldId, { skip: true });
  });

  it('should fetch locations when enabled', () => {
    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: [],
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    // Should fetch
    expect(mockUseLocationsByWorld).toHaveBeenCalledWith(mockWorldId, { skip: false });
  });

  it('should not render layers when loading', () => {
    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: [],
      loading: true,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 1,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    // Should not call addDataLayer while loading
    expect(mockAddDataLayer).not.toHaveBeenCalled();
  });

  it('should not render layers when error occurs', () => {
    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: [],
      loading: false,
      error: new Error('Test error') as never,
      refetch: vi.fn() as never,
      networkStatus: 8,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    // Should not call addDataLayer on error
    expect(mockAddDataLayer).not.toHaveBeenCalled();
  });

  it('should render point locations', async () => {
    const mockLocations = [
      {
        id: 'loc-1',
        worldId: mockWorldId,
        type: 'point',
        name: 'Test Point',
        description: 'A test point location',
        geojson: {
          type: 'Point',
          coordinates: [10.5, 20.3],
        },
      },
    ];

    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: mockLocations as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    await waitFor(() => {
      expect(mockAddDataLayer).toHaveBeenCalledWith('location-point', {
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [10.5, 20.3],
            },
            properties: expect.objectContaining({
              id: 'loc-1',
              type: 'location-point',
              name: 'Test Point',
            }),
          }),
        ]),
      });
    });
  });

  it('should render region locations', async () => {
    const mockLocations = [
      {
        id: 'loc-2',
        worldId: mockWorldId,
        type: 'region',
        name: 'Test Region',
        description: 'A test region location',
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
          ],
        },
      },
    ];

    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: mockLocations as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    await waitFor(() => {
      expect(mockAddDataLayer).toHaveBeenCalledWith('location-region', {
        type: 'FeatureCollection',
        features: expect.arrayContaining([
          expect.objectContaining({
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 10],
                  [0, 0],
                ],
              ],
            },
            properties: expect.objectContaining({
              id: 'loc-2',
              type: 'location-region',
              name: 'Test Region',
            }),
          }),
        ]),
      });
    });
  });

  it('should handle locations without geometry', async () => {
    const mockLocations = [
      {
        id: 'loc-3',
        worldId: mockWorldId,
        type: 'point',
        name: 'Point Without Geometry',
        description: null,
        geojson: null,
      },
    ];

    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: mockLocations as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    // Should not render any layers (no valid geometries)
    await waitFor(() => {
      expect(mockAddDataLayer).not.toHaveBeenCalled();
    });
  });

  it('should separate point and region locations', async () => {
    const mockLocations = [
      {
        id: 'loc-point',
        worldId: mockWorldId,
        type: 'point',
        name: 'Test Point',
        description: null,
        geojson: {
          type: 'Point',
          coordinates: [5, 5],
        },
      },
      {
        id: 'loc-region',
        worldId: mockWorldId,
        type: 'region',
        name: 'Test Region',
        description: null,
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 0],
            ],
          ],
        },
      },
    ];

    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: mockLocations as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    // Should call addDataLayer twice: once for points, once for regions
    await waitFor(() => {
      expect(mockAddDataLayer).toHaveBeenCalledTimes(2);
      expect(mockAddDataLayer).toHaveBeenCalledWith('location-point', expect.any(Object));
      expect(mockAddDataLayer).toHaveBeenCalledWith('location-region', expect.any(Object));
    });
  });

  it('should return location count', () => {
    const mockLocations = [
      {
        id: 'loc-1',
        worldId: mockWorldId,
        type: 'point',
        name: 'Location 1',
        geojson: { type: 'Point', coordinates: [0, 0] },
      },
      {
        id: 'loc-2',
        worldId: mockWorldId,
        type: 'region',
        name: 'Location 2',
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ],
        },
      },
    ];

    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: mockLocations as never,
      loading: false,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 7,
    });

    const { result } = renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    expect(result.current.locationCount).toBe(2);
  });

  it('should return loading state', () => {
    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: [],
      loading: true,
      error: undefined,
      refetch: vi.fn() as never,
      networkStatus: 1,
    });

    const { result } = renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    expect(result.current.loading).toBe(true);
  });

  it('should return error state', () => {
    const testError = new Error('Test error');
    const mockUseLocationsByWorld = vi.spyOn(api, 'useLocationsByWorld');
    mockUseLocationsByWorld.mockReturnValue({
      locations: [],
      loading: false,
      error: testError as never,
      refetch: vi.fn() as never,
      networkStatus: 8,
    });

    const { result } = renderHook(() => useLocationLayers(mockMap, mockWorldId, true));

    expect(result.current.error).toBe(testError);
  });
});
