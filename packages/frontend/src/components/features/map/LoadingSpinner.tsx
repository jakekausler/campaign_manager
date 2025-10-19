/**
 * Loading spinner component for map
 *
 * Displays a spinner overlay while map data is loading.
 * Positioned to cover the map while maintaining interactivity where possible.
 */

interface LoadingSpinnerProps {
  /**
   * Optional message to display below spinner
   */
  message?: string;

  /**
   * CSS class name for the container
   */
  className?: string;
}

/**
 * LoadingSpinner component
 *
 * Shows an animated spinner with optional message.
 * Used to indicate loading state for map data.
 */
export function LoadingSpinner({
  message = 'Loading map data...',
  className = '',
}: LoadingSpinnerProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10 ${className}`}
      data-testid="loading-spinner"
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="flex flex-col items-center space-y-4">
        {/* Spinner animation */}
        <div
          className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
          aria-hidden="true"
        />
        {/* Message text */}
        {message && <p className="text-gray-700 text-sm font-medium">{message}</p>}
      </div>
    </div>
  );
}
