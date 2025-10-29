import { useEffect } from 'react';

/**
 * KeyboardShortcut configuration
 */
export interface KeyboardShortcut {
  /** The key to press (e.g., 'b', 'f') */
  key: string;
  /** Whether Ctrl (or Cmd on Mac) is required */
  ctrl?: boolean;
  /** Whether Shift is required */
  shift?: boolean;
  /** Whether Alt is required */
  alt?: boolean;
  /** The callback to execute when the shortcut is pressed */
  handler: () => void;
  /** Optional description for documentation */
  description?: string;
  /** Whether the shortcut is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Custom hook for registering global keyboard shortcuts
 *
 * Features:
 * - Handles modifier keys (Ctrl/Cmd, Shift, Alt)
 * - Prevents default browser behavior for registered shortcuts
 * - Ignores shortcuts when typing in input/textarea elements
 * - Automatically cleans up event listeners on unmount
 *
 * @param shortcuts - Array of keyboard shortcut configurations
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   useKeyboardShortcuts([
 *     {
 *       key: 'b',
 *       ctrl: true,
 *       handler: () => setIsOpen(true),
 *       description: 'Open branch selector',
 *     },
 *   ]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Check each shortcut
      for (const shortcut of shortcuts) {
        // Skip if shortcut is disabled
        if (shortcut.enabled === false) {
          continue;
        }

        // Check if the key matches
        if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
          continue;
        }

        // Check modifier keys
        const ctrlPressed = event.ctrlKey || event.metaKey; // metaKey is Cmd on Mac
        const shiftPressed = event.shiftKey;
        const altPressed = event.altKey;

        const ctrlMatches = shortcut.ctrl === ctrlPressed || (!shortcut.ctrl && !ctrlPressed);
        const shiftMatches = shortcut.shift === shiftPressed || (!shortcut.shift && !shiftPressed);
        const altMatches = shortcut.alt === altPressed || (!shortcut.alt && !altPressed);

        if (ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.handler();
          break;
        }
      }
    };

    // Register global event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
}
