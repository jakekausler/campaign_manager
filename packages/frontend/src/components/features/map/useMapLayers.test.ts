/**
 * Unit tests for useMapLayers hook
 *
 * Tests map layer management functionality including:
 * - Adding/removing sources and layers
 * - Updating layer data
 * - Toggling layer visibility
 * - Layer lifecycle management
 */

import { renderHook, act } from '@testing-library/react';
import type { FeatureCollection, Point } from 'geojson';
import type { Map as MapLibre, GeoJSONSource } from 'maplibre-gl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocationPointProperties } from './types';
import { useMapLayers } from './useMapLayers';

describe('useMapLayers', () => {
  let mockMap: Partial<MapLibre>;
  let mockSources: Map<string, { type: string; data: FeatureCollection }>;
  let mockLayers: Map<string, { id: string; visibility: string }>;
  let mockSourceSpies: Map<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    mockSources = new Map();
    mockLayers = new Map();
    mockSourceSpies = new Map();

    mockMap = {
      addSource: vi.fn((sourceId: string, config: { type: string; data: FeatureCollection }) => {
        mockSources.set(sourceId, config);
        // Create a persistent spy for this source
        const setDataSpy = vi.fn((data: FeatureCollection) => {
          mockSources.set(sourceId, { ...config, data });
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockSourceSpies.set(sourceId, setDataSpy as any);
        return {} as MapLibre;
      }) as MapLibre['addSource'],
      getSource: vi.fn((sourceId: string) => {
        const source = mockSources.get(sourceId);
        if (!source) return undefined;
        // Return the same spy instance for consistent testing
        const setDataSpy = mockSourceSpies.get(sourceId);
        return {
          type: source.type,
          setData: setDataSpy,
        } as unknown as GeoJSONSource;
      }) as MapLibre['getSource'],
      removeSource: vi.fn((sourceId: string) => {
        mockSources.delete(sourceId);
        mockSourceSpies.delete(sourceId);
        return {} as MapLibre;
      }) as MapLibre['removeSource'],
      addLayer: vi.fn((layer: { id: string; layout?: { visibility?: string } }) => {
        mockLayers.set(layer.id, {
          id: layer.id,
          visibility: layer.layout?.visibility || 'visible',
        });
        return {} as MapLibre;
      }) as MapLibre['addLayer'],
      getLayer: vi.fn((layerId: string) => {
        return mockLayers.get(layerId);
      }) as MapLibre['getLayer'],
      removeLayer: vi.fn((layerId: string) => {
        mockLayers.delete(layerId);
        return {} as MapLibre;
      }) as MapLibre['removeLayer'],
      setLayoutProperty: vi.fn(
        (layerId: string, property: string, value: string | number | boolean) => {
          const layer = mockLayers.get(layerId);
          if (layer && property === 'visibility') {
            layer.visibility = value as string;
          }
          return {} as MapLibre;
        }
      ) as MapLibre['setLayoutProperty'],
    };
  });

  describe('Initial state', () => {
    it('should initialize with all layers visible', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      expect(result.current.layerVisibility).toEqual({
        'location-point': true,
        'location-region': true,
        settlement: true,
        structure: true,
      });
    });

    it('should handle null map', () => {
      const { result } = renderHook(() => useMapLayers(null));

      expect(result.current.layerVisibility).toBeDefined();
      expect(result.current.addSource).toBeDefined();
      expect(result.current.addLayer).toBeDefined();
    });
  });

  describe('addSource', () => {
    it('should add a GeoJSON source to the map', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.addSource('test-source', data);
      });

      expect(mockMap.addSource).toHaveBeenCalledWith('test-source', {
        type: 'geojson',
        data,
      });
      expect(mockSources.has('test-source')).toBe(true);
    });

    it('should not add source when map is null', () => {
      const { result } = renderHook(() => useMapLayers(null));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.addSource('test-source', data);
      });

      expect(mockMap.addSource).not.toHaveBeenCalled();
    });

    it('should remove existing source before adding new one', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data1: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };
      const data2: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {
              type: 'location-point',
              id: 'loc-1',
              name: 'Test',
              worldId: 'world-1',
            },
          },
        ],
      };

      act(() => {
        result.current.addSource('test-source', data1);
      });

      act(() => {
        result.current.addSource('test-source', data2);
      });

      expect(mockMap.removeSource).toHaveBeenCalledWith('test-source');
    });
  });

  describe('updateSource', () => {
    it('should update existing source data', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const initialData: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      const updatedData: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 1] },
            properties: {
              type: 'location-point',
              id: 'loc-1',
              name: 'Updated',
              worldId: 'world-1',
            },
          },
        ],
      };

      act(() => {
        result.current.addSource('test-source', initialData);
      });

      const source = mockMap.getSource!('test-source') as GeoJSONSource;
      const setDataSpy = source?.setData;

      act(() => {
        result.current.updateSource('test-source', updatedData);
      });

      expect(setDataSpy).toHaveBeenCalledWith(updatedData);
    });

    it('should add source if it does not exist', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.updateSource('new-source', data);
      });

      expect(mockMap.addSource).toHaveBeenCalledWith('new-source', {
        type: 'geojson',
        data,
      });
    });
  });

  describe('addLayer', () => {
    it('should add a layer to the map', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      act(() => {
        result.current.addLayer('test-layer', 'test-source', 'location-point');
      });

      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-layer',
          source: 'test-source',
          type: 'circle',
          layout: {
            visibility: 'visible',
          },
        })
      );
      expect(mockLayers.has('test-layer')).toBe(true);
    });

    it('should add layer with correct style for settlement type', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      act(() => {
        result.current.addLayer('settlement-layer', 'settlement-source', 'settlement');
      });

      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'settlement-layer',
          type: 'circle',
          paint: expect.objectContaining({
            'circle-color': '#10b981', // green-500
          }),
        })
      );
    });

    it('should add layer with visibility based on current state', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      // Toggle settlement visibility off
      act(() => {
        result.current.toggleLayerVisibility('settlement');
      });

      act(() => {
        result.current.addLayer('settlement-layer', 'settlement-source', 'settlement');
      });

      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          layout: {
            visibility: 'none',
          },
        })
      );
    });

    it('should remove existing layer before adding new one', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      act(() => {
        result.current.addLayer('test-layer', 'test-source', 'location-point');
      });

      act(() => {
        result.current.addLayer('test-layer', 'test-source', 'location-point');
      });

      expect(mockMap.removeLayer).toHaveBeenCalledWith('test-layer');
    });
  });

  describe('removeLayer', () => {
    it('should remove layer and source', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.addSource('test-source', data);
        result.current.addLayer('test-layer', 'test-source', 'location-point');
      });

      act(() => {
        result.current.removeLayer('test-layer', 'test-source');
      });

      expect(mockMap.removeLayer).toHaveBeenCalledWith('test-layer');
      expect(mockMap.removeSource).toHaveBeenCalledWith('test-source');
      expect(mockLayers.has('test-layer')).toBe(false);
      expect(mockSources.has('test-source')).toBe(false);
    });

    it('should handle removing non-existent layer gracefully', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      act(() => {
        result.current.removeLayer('non-existent', 'non-existent');
      });

      // Should not throw error, but also shouldn't call removeLayer since layer doesn't exist
      expect(mockMap.removeLayer).not.toHaveBeenCalled();
      expect(mockMap.removeSource).not.toHaveBeenCalled();
    });
  });

  describe('toggleLayerVisibility', () => {
    it('should toggle layer visibility state', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      expect(result.current.layerVisibility['location-point']).toBe(true);

      act(() => {
        result.current.toggleLayerVisibility('location-point');
      });

      expect(result.current.layerVisibility['location-point']).toBe(false);

      act(() => {
        result.current.toggleLayerVisibility('location-point');
      });

      expect(result.current.layerVisibility['location-point']).toBe(true);
    });

    it('should update map layer visibility when toggled', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.addSource('location-point-source', data);
        result.current.addLayer('location-point-layer', 'location-point-source', 'location-point');
      });

      act(() => {
        result.current.toggleLayerVisibility('location-point');
      });

      expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
        'location-point-layer',
        'visibility',
        'none'
      );
    });
  });

  describe('setLayerVisible', () => {
    it('should set layer visibility to specific value', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      act(() => {
        result.current.setLayerVisible('settlement', false);
      });

      expect(result.current.layerVisibility.settlement).toBe(false);

      act(() => {
        result.current.setLayerVisible('settlement', true);
      });

      expect(result.current.layerVisibility.settlement).toBe(true);
    });

    it('should update map layer visibility when set', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.addSource('settlement-source', data);
        result.current.addLayer('settlement-layer', 'settlement-source', 'settlement');
      });

      act(() => {
        result.current.setLayerVisible('settlement', false);
      });

      expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
        'settlement-layer',
        'visibility',
        'none'
      );
    });
  });

  describe('addDataLayer', () => {
    it('should add both source and layer', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const data: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      act(() => {
        result.current.addDataLayer('location-point', data);
      });

      expect(mockMap.addSource).toHaveBeenCalledWith(
        'location-point-source',
        expect.objectContaining({ type: 'geojson', data })
      );
      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'location-point-layer',
          source: 'location-point-source',
        })
      );
    });
  });

  describe('updateDataLayer', () => {
    it('should update data for existing layer', () => {
      const { result } = renderHook(() => useMapLayers(mockMap as MapLibre));

      const initialData: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [],
      };

      const updatedData: FeatureCollection<Point, LocationPointProperties> = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [0, 0] },
            properties: {
              type: 'location-point',
              id: 'loc-1',
              name: 'Test',
              worldId: 'world-1',
            },
          },
        ],
      };

      act(() => {
        result.current.addDataLayer('location-point', initialData);
      });

      const source = mockMap.getSource!('location-point-source') as GeoJSONSource;
      const setDataSpy = source?.setData;

      act(() => {
        result.current.updateDataLayer('location-point', updatedData);
      });

      expect(setDataSpy).toHaveBeenCalledWith(updatedData);
    });
  });
});
