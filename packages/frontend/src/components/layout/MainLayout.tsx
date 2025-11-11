import { useMemo, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { ConnectionIndicator } from '@/components';
import { BranchSelector, type BranchSelectorHandle } from '@/components/features';
import { Button } from '@/components/ui';
import { useKeyboardShortcuts } from '@/hooks';
import { useCurrentCampaignId } from '@/stores';

/**
 * Main application layout with navigation header
 *
 * Used for public and authenticated pages with full navigation.
 * Includes branch selector when a campaign is active.
 * Provides global keyboard shortcuts for branch operations.
 */
export function MainLayout() {
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('auth_token');
  // Use specific selector to avoid re-rendering on unrelated campaign store changes
  const currentCampaignId = useCurrentCampaignId();
  const branchSelectorRef = useRef<BranchSelectorHandle>(null);

  // Register global keyboard shortcuts for branch operations
  // Memoize shortcuts array to prevent infinite re-render loop
  const shortcuts = useMemo(
    () => [
      {
        key: 'b',
        ctrl: true,
        handler: () => branchSelectorRef.current?.openBranchSelector(),
        description: 'Open branch selector',
        enabled: isAuthenticated && !!currentCampaignId,
      },
      {
        key: 'f',
        ctrl: true,
        shift: true,
        handler: () => branchSelectorRef.current?.openForkDialog(),
        description: 'Fork current branch',
        enabled: isAuthenticated && !!currentCampaignId,
      },
    ],
    [isAuthenticated, currentCampaignId]
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with navigation */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold">
              Campaign Manager
            </Link>

            <nav className="hidden md:flex md:gap-6">
              <Link
                to="/"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === '/' ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                Home
              </Link>

              {isAuthenticated && (
                <>
                  <Link
                    to="/dashboard"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      location.pathname === '/dashboard'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Dashboard
                  </Link>

                  <Link
                    to="/map"
                    className={`text-sm font-medium transition-colors hover:text-primary ${
                      location.pathname === '/map' ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    Map
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection status indicator (only shown when authenticated) */}
            {isAuthenticated && <ConnectionIndicator />}

            {/* Branch selector (shown when campaign is selected) */}
            {isAuthenticated && currentCampaignId && <BranchSelector ref={branchSelectorRef} />}

            {!isAuthenticated ? (
              <Link to="/auth/login">
                <Button>Log In</Button>
              </Link>
            ) : (
              <Link to="/dashboard">
                <Button variant="outline">Dashboard</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Campaign Manager - Tabletop RPG Campaign Management Tool</p>
        </div>
      </footer>
    </div>
  );
}
