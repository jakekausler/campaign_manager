import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorMessage } from './ErrorMessage';

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks();
});

describe('ErrorMessage', () => {
  describe('Rendering', () => {
    it('should render with default title and custom message', () => {
      const message = 'Failed to load data';
      render(<ErrorMessage message={message} />);

      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('should render with custom title and message', () => {
      const title = 'Custom Error Title';
      const message = 'Custom error message';
      render(<ErrorMessage title={title} message={message} />);

      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const customClass = 'custom-error-class';
      render(<ErrorMessage message="Error" className={customClass} />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toHaveClass(customClass);
    });

    it('should not render retry button when onRetry not provided', () => {
      render(<ErrorMessage message="Error occurred" />);

      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });

    it('should render retry button when onRetry provided', () => {
      const onRetry = vi.fn();
      render(<ErrorMessage message="Error occurred" onRetry={onRetry} />);

      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onRetry when retry button clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(<ErrorMessage message="Error occurred" onRetry={onRetry} />);

      const retryButton = screen.getByTestId('retry-button');
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry multiple times when clicked multiple times', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(<ErrorMessage message="Error occurred" onRetry={onRetry} />);

      const retryButton = screen.getByTestId('retry-button');
      await user.click(retryButton);
      await user.click(retryButton);
      await user.click(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert"', () => {
      render(<ErrorMessage message="Error occurred" />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toHaveAttribute('role', 'alert');
    });

    it('should have aria-live="assertive"', () => {
      render(<ErrorMessage message="Error occurred" />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should mark error icon as aria-hidden', () => {
      render(<ErrorMessage message="Error occurred" />);

      const iconContainer = screen.getByTestId('error-message').querySelector('.bg-red-100');
      expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have proper heading hierarchy', () => {
      const title = 'Error Title';
      render(<ErrorMessage title={title} message="Error message" />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent(title);
    });
  });

  describe('Styling', () => {
    it('should have overlay styling', () => {
      render(<ErrorMessage message="Error occurred" />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toHaveClass('absolute', 'inset-0', 'bg-white', 'bg-opacity-90');
    });

    it('should be positioned above map content', () => {
      render(<ErrorMessage message="Error occurred" />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toHaveClass('z-10');
    });

    it('should center content', () => {
      render(<ErrorMessage message="Error occurred" />);

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });
});
