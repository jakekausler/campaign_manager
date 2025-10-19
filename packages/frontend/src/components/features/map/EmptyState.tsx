/**
 * Empty state component for map
 *
 * Displays a message when no map data is available to display.
 * Provides helpful messaging to guide users.
 */

interface EmptyStateProps {
  /**
   * Empty state title
   */
  title?: string;

  /**
   * Empty state message or description
   */
  message: string;

  /**
   * CSS class name for the container
   */
  className?: string;
}

/**
 * EmptyState component
 *
 * Shows an empty state with icon and message.
 * Used to indicate no data available for map.
 */
export function EmptyState({
  title = 'No Data Available',
  message,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10 ${className}`}
      data-testid="empty-state"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="flex flex-col items-center space-y-4 text-center">
          {/* Empty state icon */}
          <div
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"
            aria-hidden="true"
          >
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
          </div>

          {/* Empty state title */}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

          {/* Empty state message */}
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}
