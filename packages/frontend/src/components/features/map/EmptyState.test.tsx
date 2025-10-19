import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('Rendering', () => {
    it('should render with default title and custom message', () => {
      const message = 'No data to display';
      render(<EmptyState message={message} />);

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No Data Available')).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('should render with custom title and message', () => {
      const title = 'Custom Empty Title';
      const message = 'Custom empty message';
      render(<EmptyState title={title} message={message} />);

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const customClass = 'custom-empty-class';
      render(<EmptyState message="No data" className={customClass} />);

      const emptyElement = screen.getByTestId('empty-state');
      expect(emptyElement).toHaveClass(customClass);
    });
  });

  describe('Accessibility', () => {
    it('should have role="status"', () => {
      render(<EmptyState message="No data available" />);

      const emptyElement = screen.getByTestId('empty-state');
      expect(emptyElement).toHaveAttribute('role', 'status');
    });

    it('should have aria-live="polite"', () => {
      render(<EmptyState message="No data available" />);

      const emptyElement = screen.getByTestId('empty-state');
      expect(emptyElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should mark icon as aria-hidden', () => {
      render(<EmptyState message="No data available" />);

      const iconContainer = screen.getByTestId('empty-state').querySelector('.bg-gray-100');
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have proper heading hierarchy', () => {
      const title = 'Empty State Title';
      render(<EmptyState title={title} message="No data" />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent(title);
    });
  });

  describe('Styling', () => {
    it('should have overlay styling', () => {
      render(<EmptyState message="No data available" />);

      const emptyElement = screen.getByTestId('empty-state');
      expect(emptyElement).toHaveClass('absolute', 'inset-0', 'bg-white', 'bg-opacity-90');
    });

    it('should be positioned above map content', () => {
      render(<EmptyState message="No data available" />);

      const emptyElement = screen.getByTestId('empty-state');
      expect(emptyElement).toHaveClass('z-10');
    });

    it('should center content', () => {
      render(<EmptyState message="No data available" />);

      const emptyElement = screen.getByTestId('empty-state');
      expect(emptyElement).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });
});
