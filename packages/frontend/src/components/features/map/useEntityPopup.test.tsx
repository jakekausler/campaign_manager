import { renderHook, act } from '@testing-library/react';
import { Map as MapLibre, Popup } from 'maplibre-gl';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PopupData } from './types';
import { useEntityPopup } from './useEntityPopup';

// Mock maplibre-gl
vi.mock('maplibre-gl', () => {
  const mockPopup = {
    setLngLat: vi.fn().mockReturnThis(),
    setDOMContent: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  return {
    Map: vi.fn(),
    NavigationControl: vi.fn(),
    Popup: vi.fn(() => mockPopup),
  };
});

// Mock React DOM
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
    unmount: vi.fn(),
  })),
}));

describe('useEntityPopup', () => {
  let mockMap: MapLibre;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMap = {} as MapLibre;
  });

  it('should return popup functions and state', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    expect(result.current).toHaveProperty('showPopup');
    expect(result.current).toHaveProperty('closePopup');
    expect(result.current).toHaveProperty('isPopupOpen');
    expect(typeof result.current.showPopup).toBe('function');
    expect(typeof result.current.closePopup).toBe('function');
    expect(typeof result.current.isPopupOpen).toBe('boolean');
  });

  it('should initially have no popup open', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    expect(result.current.isPopupOpen).toBe(false);
  });

  it('should show location popup', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    const locationData: PopupData = {
      type: 'location-point',
      id: 'loc-1',
      name: 'Test Location',
      description: 'A test location',
      coordinates: [10, 20],
    };

    act(() => {
      result.current.showPopup(locationData);
    });

    expect(Popup).toHaveBeenCalledWith({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '400px',
    });
    expect(result.current.isPopupOpen).toBe(true);
  });

  it('should show settlement popup', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    const settlementData: PopupData = {
      type: 'settlement',
      id: 'settlement-1',
      name: 'Test Settlement',
      level: 3,
      typedVariables: { population: 1000 },
      coordinates: [30, 40],
    };

    act(() => {
      result.current.showPopup(settlementData);
    });

    expect(Popup).toHaveBeenCalled();
    expect(result.current.isPopupOpen).toBe(true);
  });

  it('should show structure popup', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    const structureData: PopupData = {
      type: 'structure',
      id: 'structure-1',
      name: 'Test Structure',
      structureType: 'BARRACKS',
      level: 2,
      coordinates: [50, 60],
    };

    act(() => {
      result.current.showPopup(structureData);
    });

    expect(Popup).toHaveBeenCalled();
    expect(result.current.isPopupOpen).toBe(true);
  });

  it('should close existing popup when showing new one', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    const data1: PopupData = {
      type: 'location-point',
      id: 'loc-1',
      name: 'Location 1',
      coordinates: [10, 20],
    };

    const data2: PopupData = {
      type: 'location-point',
      id: 'loc-2',
      name: 'Location 2',
      coordinates: [30, 40],
    };

    act(() => {
      result.current.showPopup(data1);
    });

    const firstPopup = vi.mocked(Popup).mock.results[0].value;

    act(() => {
      result.current.showPopup(data2);
    });

    expect(firstPopup.remove).toHaveBeenCalled();
    expect(Popup).toHaveBeenCalledTimes(2);
  });

  it('should close popup when closePopup is called', () => {
    const { result } = renderHook(() => useEntityPopup(mockMap));

    const data: PopupData = {
      type: 'location-point',
      id: 'loc-1',
      name: 'Test',
      coordinates: [10, 20],
    };

    act(() => {
      result.current.showPopup(data);
    });

    expect(result.current.isPopupOpen).toBe(true);

    const popup = vi.mocked(Popup).mock.results[0].value;

    act(() => {
      result.current.closePopup();
    });

    expect(popup.remove).toHaveBeenCalled();
    expect(result.current.isPopupOpen).toBe(false);
  });

  it('should not show popup if map is null', () => {
    const { result } = renderHook(() => useEntityPopup(null));

    const data: PopupData = {
      type: 'location-point',
      id: 'loc-1',
      name: 'Test',
      coordinates: [10, 20],
    };

    act(() => {
      result.current.showPopup(data);
    });

    expect(Popup).not.toHaveBeenCalled();
    expect(result.current.isPopupOpen).toBe(false);
  });

  it('should cleanup popup on unmount', () => {
    const { result, unmount } = renderHook(() => useEntityPopup(mockMap));

    const data: PopupData = {
      type: 'location-point',
      id: 'loc-1',
      name: 'Test',
      coordinates: [10, 20],
    };

    act(() => {
      result.current.showPopup(data);
    });

    const popup = vi.mocked(Popup).mock.results[0].value;

    unmount();

    expect(popup.remove).toHaveBeenCalled();
  });
});
