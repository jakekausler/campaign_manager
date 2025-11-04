import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';

import { enableMemoryProfiling, printMemorySummary } from '@/__tests__/utils/test-memory-profiler';
import { GET_LOCATION_DETAILS } from '@/services/api/hooks/locations';

import { LocationContextPanel } from './LocationContextPanel';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

/**
 * Test suite for LocationContextPanel component
 *
 * Covers:
 * - Loading state rendering
 * - Error state handling
 * - Missing location display
 * - Point geometry coordinate extraction and formatting
 * - Polygon geometry coordinate extraction
 * - "Jump to Location" button navigation
 * - Location name, type, and description display
 * - Settlement context display
 */

// Helper to create Apollo mocks
function createMock(location: unknown, error?: Error): MockedResponse {
  return {
    request: {
      query: GET_LOCATION_DETAILS,
      variables: { id: 'location-1' },
    },
    result: error ? undefined : { data: { location } },
    error,
  };
}

// Helper component to wrap with router
function renderWithRouter(ui: React.ReactElement, mocks: MockedResponse[] = []) {
  const user = userEvent.setup();
  const result = render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={ui} />
          <Route path="/map" element={<div>Map Page</div>} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>
  );
  return { user, ...result };
}

describe('LocationContextPanel', () => {
  // Phase 2 (Mitigation Plan) Task 2.3: Enable memory profiling for diagnostic visibility
  enableMemoryProfiling({ warnThresholdMB: 50 });

  afterAll(() => {
    printMemorySummary({ sortBy: 'rss', topN: 10 });
  });

  describe('Loading State', () => {
    it('should display loading skeleton while fetching location', () => {
      const mock = createMock(null);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      // Check for skeleton loaders
      const skeletons = screen.getAllByTestId('skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show location context heading during loading', () => {
      const mock = createMock(null);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      expect(screen.getByText('Location Context')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when location fetch fails', async () => {
      const error = new Error('Failed to fetch location');
      const mock = createMock(null, error);

      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Failed to load location/i)).toBeInTheDocument();
    });

    it('should display specific error message from server', async () => {
      const error = new Error('Location not found');
      const mock = createMock(null, error);

      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.getByText(/Location not found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Missing Location State', () => {
    it('should display message when location is null', async () => {
      const mock = createMock(null);

      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.getByText(/No location data available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Point Geometry - Coordinate Extraction', () => {
    it('should extract and display coordinates from Point geometry', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Capital City Center',
        description: 'The central plaza',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749], // [longitude, latitude]
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        // Coordinates should be formatted as "lat, lon" with 6 decimal places
        expect(screen.getByText('37.774900°, -122.419400°')).toBeInTheDocument();
      });
    });

    it('should format coordinates to 6 decimal places', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Test Location',
        geojson: {
          type: 'Point',
          coordinates: [-122.123456789, 37.987654321],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        // Should be truncated to 6 decimal places
        expect(screen.getByText('37.987654°, -122.123457°')).toBeInTheDocument();
      });
    });
  });

  describe('Polygon Geometry - Coordinate Extraction', () => {
    it('should extract coordinates from first point of Polygon geometry', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'region',
        name: 'Kingdom Territory',
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.5, 37.8],
              [-122.4, 37.8],
              [-122.4, 37.7],
              [-122.5, 37.7],
              [-122.5, 37.8], // Closed polygon
            ],
          ],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        // Should extract first point from polygon
        expect(screen.getByText('37.800000°, -122.500000°')).toBeInTheDocument();
      });
    });
  });

  describe('Invalid Geometry Handling', () => {
    it('should display N/A for missing geojson', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Location Without Geometry',
        geojson: null,
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        const coordinateFields = screen.getAllByText('N/A');
        expect(coordinateFields.length).toBeGreaterThan(0);
      });
    });

    it('should disable "Jump to Location" button when no coordinates', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Location Without Coordinates',
        geojson: {},
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        const jumpButton = screen.getByRole('button', {
          name: /Jump to Location on Map/i,
        });
        expect(jumpButton).toBeDisabled();
      });
    });
  });

  describe('Location Name Display', () => {
    it('should display location name when provided', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Grand Palace',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.getByText('Grand Palace')).toBeInTheDocument();
      });
    });

    it('should display "Unnamed Location" when name is null', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: null,
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.getByText('Unnamed Location')).toBeInTheDocument();
      });
    });
  });

  describe('Location Type Display', () => {
    it('should display location type with capitalization', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'region',
        name: 'Test Location',
        geojson: {
          type: 'Polygon',
          coordinates: [
            [
              [-122.5, 37.8],
              [-122.4, 37.8],
              [-122.4, 37.7],
              [-122.5, 37.7],
              [-122.5, 37.8],
            ],
          ],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        // Type should be capitalized via CSS capitalize class
        const typeElements = screen.getAllByText('region');
        expect(typeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Description Display', () => {
    it('should display location description when provided', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Ancient Temple',
        description: 'A mysterious temple from the old empire',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.getByText('A mysterious temple from the old empire')).toBeInTheDocument();
      });
    });

    it('should not display description section when description is null', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Simple Location',
        description: null,
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.queryByText('Description')).not.toBeInTheDocument();
      });
    });
  });

  describe('Settlement Context Display', () => {
    it('should display settlement context when settlementName is provided', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Location Name',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(
        <LocationContextPanel locationId="location-1" settlementName="Capital City" />,
        [mock]
      );

      await waitFor(() => {
        expect(screen.getByText(/Capital City/i)).toBeInTheDocument();
        expect(screen.getByText(/This location is associated with/i)).toBeInTheDocument();
      });
    });

    it('should not display settlement context when settlementName is omitted', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Location Name',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(screen.queryByText(/This location is associated with/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Jump to Location Navigation', () => {
    it('should navigate to /map when "Jump to Location" is clicked', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Test Location',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      const { user } = renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /Jump to Location on Map/i })
        ).toBeInTheDocument();
      });

      const jumpButton = screen.getByRole('button', { name: /Jump to Location on Map/i });
      await user.click(jumpButton);

      // Should navigate to map page
      await waitFor(() => {
        expect(screen.getByText('Map Page')).toBeInTheDocument();
      });
    });

    it('should enable button only when coordinates are available', async () => {
      const location = {
        id: 'location-1',
        worldId: 'world-1',
        type: 'point',
        name: 'Valid Location',
        geojson: {
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        },
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const mock = createMock(location);
      renderWithRouter(<LocationContextPanel locationId="location-1" />, [mock]);

      await waitFor(() => {
        const jumpButton = screen.getByRole('button', {
          name: /Jump to Location on Map/i,
        });
        expect(jumpButton).not.toBeDisabled();
      });
    });
  });
});
