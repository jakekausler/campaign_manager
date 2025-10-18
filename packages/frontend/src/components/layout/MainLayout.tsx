import { Link, Outlet, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui';

/**
 * Main application layout with navigation header
 *
 * Used for public and authenticated pages with full navigation.
 */
export function MainLayout() {
  const location = useLocation();
  const isAuthenticated = !!localStorage.getItem('auth_token');

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
                <Link
                  to="/dashboard"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location.pathname === '/dashboard' ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Dashboard
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
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
