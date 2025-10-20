import { Component, ReactNode, ErrorInfo } from 'react';

/**
 * Props for ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  /**
   * Child components to render (and protect with error boundary)
   */
  children: ReactNode;

  /**
   * Optional fallback UI to display when error occurs
   */
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode);

  /**
   * Optional callback fired when error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Optional name for this error boundary (helps with debugging)
   */
  boundaryName?: string;
}

/**
 * State for ErrorBoundary component
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - React error boundary component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing
 * the entire application.
 *
 * Features:
 * - Catches rendering errors in child components
 * - Displays fallback UI with error details
 * - Optional error logging callback
 * - Reset functionality to recover from errors
 * - Named boundaries for better debugging
 *
 * Part of TICKET-022 Stage 12 implementation.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   boundaryName="Timeline"
 *   fallback={(error, errorInfo, reset) => (
 *     <div>
 *       <h2>Timeline Error</h2>
 *       <p>{error.message}</p>
 *       <button onClick={reset}>Try Again</button>
 *     </div>
 *   )}
 *   onError={(error, errorInfo) => {
 *     console.error('Timeline error:', error, errorInfo);
 *   }}
 * >
 *   <Timeline items={items} />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method called when an error is thrown during rendering
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows fallback UI
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after an error is caught
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Store error info in state
    this.setState({
      errorInfo,
    });

    // Log error details
    const boundaryName = this.props.boundaryName || 'ErrorBoundary';
    console.error(`[${boundaryName}] Caught error:`, error);
    console.error(`[${boundaryName}] Error info:`, errorInfo);

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset error state to attempt recovery
   */
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, boundaryName } = this.props;

    if (hasError && error && errorInfo) {
      // Custom fallback provided
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, errorInfo, this.resetError);
        }
        return fallback;
      }

      // Default fallback UI
      const name = boundaryName || 'Component';
      return (
        <div
          className="flex items-center justify-center p-8 bg-destructive/10 border border-destructive/20 rounded-lg"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center max-w-2xl">
            <h2 className="text-xl font-semibold text-destructive mb-2">{name} Error</h2>
            <p className="text-sm text-muted-foreground mb-4">
              An error occurred while rendering this component.
            </p>

            <details className="text-left bg-card border rounded p-4 mb-4">
              <summary className="cursor-pointer font-medium text-sm mb-2">Error Details</summary>
              <div className="text-xs space-y-2">
                <div>
                  <strong>Error:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-auto">{error.message}</pre>
                </div>
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-auto text-xs">
                    {error.stack}
                  </pre>
                </div>
                {errorInfo.componentStack && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="mt-1 p-2 bg-muted rounded overflow-auto text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>

            <button
              type="button"
              onClick={this.resetError}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label={`Retry ${name}`}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
