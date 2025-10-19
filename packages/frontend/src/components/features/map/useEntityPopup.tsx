import { Popup } from 'maplibre-gl';
import type { Map as MapLibre } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  LocationPopupContent,
  SettlementPopupContent,
  StructurePopupContent,
} from './EntityPopupContent';
import type { PopupData } from './types';

/**
 * Hook for managing entity popups on the map
 *
 * Uses MapLibre's Popup API with React portal rendering for popup content
 */
export function useEntityPopup(map: MapLibre | null) {
  const [currentPopup, setCurrentPopup] = useState<Popup | null>(null);
  const reactRootRef = useRef<Root | null>(null);

  /**
   * Shows a popup for the given entity data
   */
  const showPopup = useCallback(
    (data: PopupData) => {
      if (!map) return;

      // Close existing popup if any
      if (currentPopup) {
        currentPopup.remove();
        setCurrentPopup(null);
      }

      // Clean up existing React root
      if (reactRootRef.current) {
        reactRootRef.current.unmount();
        reactRootRef.current = null;
      }

      // Create popup container
      const popupContainer = document.createElement('div');

      // Create React root for the popup content
      const root = createRoot(popupContainer);
      reactRootRef.current = root;

      // Render appropriate popup content based on entity type
      if (data.type === 'location-point' || data.type === 'location-region') {
        root.render(<LocationPopupContent data={data} />);
      } else if (data.type === 'settlement') {
        root.render(<SettlementPopupContent data={data} />);
      } else if (data.type === 'structure') {
        root.render(<StructurePopupContent data={data} />);
      }

      // Create and show MapLibre popup
      const popup = new Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '400px',
      })
        .setLngLat(data.coordinates)
        .setDOMContent(popupContainer)
        .addTo(map);

      // Clean up React root when popup is closed
      popup.on('close', () => {
        if (reactRootRef.current) {
          reactRootRef.current.unmount();
          reactRootRef.current = null;
        }
        setCurrentPopup(null);
      });

      setCurrentPopup(popup);
    },
    [map, currentPopup]
  );

  /**
   * Closes the current popup
   */
  const closePopup = useCallback(() => {
    if (currentPopup) {
      currentPopup.remove();
      setCurrentPopup(null);
    }
    if (reactRootRef.current) {
      reactRootRef.current.unmount();
      reactRootRef.current = null;
    }
  }, [currentPopup]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      closePopup();
    };
  }, [closePopup]);

  return {
    showPopup,
    closePopup,
    isPopupOpen: currentPopup !== null,
  };
}
