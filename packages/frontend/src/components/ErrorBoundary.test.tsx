import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Working component</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error during tests (error boundaries log errors)
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('catches errors thrown by children', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Should show default error UI
    expect(screen.getByText('Component Error')).toBeInTheDocument();
    expect(screen.getByText(/An error occurred while rendering/)).toBeInTheDocument();
  });

  it('displays error message in details', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Error details should be in the document (may appear multiple times in stack trace)
    const errorMessages = screen.getAllByText(/Test error message/);
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('uses custom boundary name', () => {
    render(
      <ErrorBoundary boundaryName="Timeline">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Timeline Error')).toBeInTheDocument();
  });

  it('calls onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error message' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('renders custom fallback UI', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('renders custom fallback function with error details', () => {
    const fallbackFn = vi.fn((error, _errorInfo, reset) => (
      <div>
        <div>Error: {error.message}</div>
        <button onClick={reset}>Reset</button>
      </div>
    ));

    render(
      <ErrorBoundary fallback={fallbackFn}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // React may call fallback function multiple times during error handling
    expect(fallbackFn).toHaveBeenCalled();
    expect(screen.getByText('Error: Test error message')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', async () => {
    const user = userEvent.setup();

    // Use a ref to control whether to throw (persists across error boundary resets)
    const shouldThrowRef = { current: true };

    // Component that reads from ref
    function ControlledError() {
      if (shouldThrowRef.current) {
        throw new Error('Test error message');
      }
      return <div>Working component</div>;
    }

    render(
      <ErrorBoundary>
        <ControlledError />
      </ErrorBoundary>
    );

    // Error UI should be visible
    expect(screen.getByText('Component Error')).toBeInTheDocument();

    // Fix the component externally (simulates fixing the root cause)
    shouldThrowRef.current = false;

    // Click reset button to retry rendering
    const resetButton = screen.getByText('Try Again');
    await user.click(resetButton);

    // Component should now render successfully
    expect(await screen.findByText('Working component')).toBeInTheDocument();
    expect(screen.queryByText('Component Error')).not.toBeInTheDocument();
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const errorContainer = screen.getByRole('alert');
    expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
  });

  it('provides accessible reset button with aria-label', () => {
    render(
      <ErrorBoundary boundaryName="Timeline">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const resetButton = screen.getByRole('button', { name: 'Retry Timeline' });
    expect(resetButton).toBeInTheDocument();
  });

  it('shows collapsible error details', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    // Details element should be present
    const details = screen.getByText('Error Details').closest('details');
    expect(details).toBeInTheDocument();
  });

  it('logs errors to console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary boundaryName="TestBoundary">
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(consoleError).toHaveBeenCalled();
    // Should log with boundary name (check all calls since React logs first)
    const calls = consoleError.mock.calls.map((call) => call.join(' '));
    expect(calls.some((call) => call.includes('[TestBoundary]'))).toBe(true);
  });
});
