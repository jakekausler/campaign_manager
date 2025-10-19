import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import MapPage from './MapPage';

// Mock the Map component
vi.mock('@/components/features/map', () => ({
  Map: vi.fn(({ initialCenter, initialZoom, worldId, kingdomId, campaignId }) => (
    <div data-testid="map-component">
      Map Component
      <div data-testid="map-initial-center">{JSON.stringify(initialCenter)}</div>
      <div data-testid="map-initial-zoom">{initialZoom}</div>
      <div data-testid="map-world-id">{worldId}</div>
      <div data-testid="map-kingdom-id">{kingdomId}</div>
      <div data-testid="map-campaign-id">{campaignId}</div>
    </div>
  )),
  ViewportState: {} as unknown,
}));

describe('MapPage', () => {
  it('should render page header with title', () => {
    render(<MapPage />);

    expect(screen.getByRole('heading', { name: /campaign map/i })).toBeInTheDocument();
    expect(screen.getByText(/interactive view of your campaign world/i)).toBeInTheDocument();
  });

  it('should render Map component', () => {
    render(<MapPage />);

    expect(screen.getByTestId('map-component')).toBeInTheDocument();
  });

  it('should pass initial center [0, 0] to Map', () => {
    render(<MapPage />);

    expect(screen.getByTestId('map-initial-center')).toHaveTextContent('[0,0]');
  });

  it('should pass initial zoom 2 to Map', () => {
    render(<MapPage />);

    expect(screen.getByTestId('map-initial-zoom')).toHaveTextContent('2');
  });

  it('should pass placeholder worldId to Map', () => {
    render(<MapPage />);

    expect(screen.getByTestId('map-world-id')).toHaveTextContent('world-placeholder-id');
  });

  it('should pass placeholder kingdomId to Map', () => {
    render(<MapPage />);

    expect(screen.getByTestId('map-kingdom-id')).toHaveTextContent('kingdom-placeholder-id');
  });

  it('should pass placeholder campaignId to Map', () => {
    render(<MapPage />);

    expect(screen.getByTestId('map-campaign-id')).toHaveTextContent('campaign-placeholder-id');
  });

  it('should render footer with viewport info', () => {
    render(<MapPage />);

    // Footer contains initial viewport info (from state initialization)
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent(/viewing/i);
    expect(footer).toHaveTextContent(/zoom/i);
    expect(footer).toHaveTextContent(/center/i);
  });

  it('should have full-screen flex layout', () => {
    const { container } = render(<MapPage />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass('h-screen', 'flex', 'flex-col');
  });

  it('should have header with proper styling', () => {
    render(<MapPage />);

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-white', 'border-b', 'border-gray-200');
  });

  it('should have main content area with flex-1', () => {
    const { container } = render(<MapPage />);

    const main = container.querySelector('main');
    expect(main).toHaveClass('flex-1', 'relative');
  });

  it('should have footer with proper styling', () => {
    render(<MapPage />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('bg-white', 'border-t', 'border-gray-200');
  });
});
