import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoadingSpinner } from './LoadingSpinner';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

describe('LoadingSpinner', () => {
  describe('Rendering', () => {
    it('should render with default message', () => {
      render(<LoadingSpinner />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading map data...')).toBeInTheDocument();
    });

    it('should render with custom message', () => {
      const customMessage = 'Fetching settlements...';
      render(<LoadingSpinner message={customMessage} />);

      expect(screen.getByText(customMessage)).toBeInTheDocument();
      expect(screen.queryByText('Loading map data...')).not.toBeInTheDocument();
    });

    it('should render without message when empty string provided', () => {
      render(<LoadingSpinner message="" />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByText('Loading map data...')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const customClass = 'custom-test-class';
      render(<LoadingSpinner className={customClass} />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass(customClass);
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('role', 'status');
    });

    it('should have aria-live="polite"', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-label matching message', () => {
      const message = 'Custom loading message';
      render(<LoadingSpinner message={message} />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('aria-label', message);
    });

    it('should mark spinner animation as aria-hidden', () => {
      render(<LoadingSpinner />);

      const spinnerElement = screen.getByTestId('loading-spinner').querySelector('.animate-spin');
      expect(spinnerElement).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Styling', () => {
    it('should have overlay styling', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('absolute', 'inset-0', 'bg-white', 'bg-opacity-75');
    });

    it('should be positioned above map content', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('z-10');
    });

    it('should center content', () => {
      render(<LoadingSpinner />);

      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });
});
