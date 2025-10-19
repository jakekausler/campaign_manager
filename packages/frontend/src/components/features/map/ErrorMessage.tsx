/**
 * Error message component for map
 *
 * Displays error messages when map data fails to load.
 * Provides retry functionality and clear error messaging.
 */

interface ErrorMessageProps {
  /**
   * Error title
   */
  title?: string;

  /**
   * Error message or description
   */
  message: string;

  /**
   * Optional retry callback
   */
  onRetry?: () => void;

  /**
   * CSS class name for the container
   */
  className?: string;
}

/**
 * ErrorMessage component
 *
 * Shows an error state with icon, message, and optional retry button.
 * Used to indicate failed data loading for map.
 */
export function ErrorMessage({
  title = 'Error Loading Data',
  message,
  onRetry,
  className = '',
}: ErrorMessageProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10 ${className}`}
      data-testid="error-message"
      role="alert"
      aria-live="assertive"
    >
      <div className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-red-200">
        <div className="flex flex-col items-center space-y-4 text-center">
          {/* Error icon */}
          <div
            className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center"
            aria-hidden="true"
          >
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Error title */}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

          {/* Error message */}
          <p className="text-sm text-gray-600">{message}</p>

          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              data-testid="retry-button"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
