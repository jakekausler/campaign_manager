/**
 * Barrel export for custom React hooks
 *
 * Custom hooks encapsulate and share stateful logic across components.
 * Import from this file to use hooks throughout the app.
 */

// Timeline hooks
export { useTimelineData } from './useTimelineData';
export { useTimelineReschedule } from './useTimelineReschedule';
export type { UseTimelineRescheduleOptions, RescheduleResult } from './useTimelineReschedule';

// Edit mode hooks
export { useEditMode } from './useEditMode';
export type {
  UseEditModeOptions,
  UseEditModeResult,
  FieldError,
  FieldValidator,
} from './useEditMode';

// Keyboard shortcuts
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export type { KeyboardShortcut } from './useKeyboardShortcuts';

// WebSocket subscription hooks
export {
  useCampaignSubscription,
  useSettlementSubscription,
  useStructureSubscription,
  useWebSocketSubscription,
} from './useWebSocketSubscription';
export type {
  CampaignEventHandlers,
  SettlementEventHandlers,
  StructureEventHandlers,
  WebSocketEventHandler,
} from './useWebSocketSubscription';

// WebSocket cache synchronization
export { useWebSocketCacheSync } from './useWebSocketCacheSync';

// Export custom hooks here as they are created
// Example:
// export { useAuth } from './useAuth';
// export { useCampaign } from './useCampaign';
// export { useWorldTime } from './useWorldTime';
// export { useDebounce } from './useDebounce';
// export { useLocalStorage } from './useLocalStorage';
