import { memo } from 'react';

/**
 * FlowLoadingSkeleton - Loading state for Flow View
 *
 * Displays a skeleton UI while the dependency graph is being loaded and rendered.
 * This provides better perceived performance by showing placeholders instead of
 * a blank screen.
 *
 * Part of TICKET-021 Stage 10: Performance Optimization
 */
function FlowLoadingSkeletonComponent() {
  return (
    <div className="h-screen w-full bg-background">
      {/* Toolbar skeleton */}
      <div className="absolute top-4 left-4 z-10 bg-card border rounded-lg shadow-lg p-2 animate-pulse">
        <div className="h-9 w-32 bg-muted rounded" />
      </div>

      {/* Stats panel skeleton */}
      <div className="absolute top-4 right-4 bg-card border rounded-lg p-4 shadow-lg max-w-xs animate-pulse">
        <div className="h-6 w-40 bg-muted rounded mb-3" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="h-px bg-border my-2" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-muted" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Node skeletons in center */}
      <div className="flex items-center justify-center h-full">
        <div className="grid grid-cols-3 gap-8 animate-pulse">
          {/* Row 1 */}
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />

          {/* Row 2 */}
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />

          {/* Row 3 */}
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
          <div className="w-44 h-16 bg-card border-2 rounded-lg shadow-md" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="absolute bottom-4 right-4 space-y-2 animate-pulse">
        <div className="w-48 h-32 bg-card border rounded-lg shadow-lg" />
        <div className="w-10 h-28 bg-card border rounded-lg shadow-lg" />
      </div>

      {/* Zoom indicator skeleton */}
      <div className="absolute bottom-4 left-4 bg-card border rounded-lg px-3 py-2 shadow-lg animate-pulse">
        <div className="h-5 w-20 bg-muted rounded" />
      </div>

      {/* Loading text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <div className="text-lg font-medium">Loading dependency graph...</div>
          <div className="text-sm text-muted-foreground mt-2">
            Building visualization of campaign relationships
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Memoized loading skeleton to prevent unnecessary re-renders.
 */
export const FlowLoadingSkeleton = memo(FlowLoadingSkeletonComponent);

FlowLoadingSkeleton.displayName = 'FlowLoadingSkeleton';
