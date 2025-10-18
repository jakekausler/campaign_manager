import { Link, Outlet } from 'react-router-dom';

/**
 * Authentication layout for login/register pages
 *
 * Minimal layout focused on the authentication form with branding.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Simple header with branding */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link to="/" className="text-xl font-bold">
            Campaign Manager
          </Link>
        </div>
      </header>

      {/* Main content area (centered auth form) */}
      <main className="flex flex-1 items-center justify-center">
        <Outlet />
      </main>

      {/* Minimal footer */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Back to Home
          </Link>
        </div>
      </footer>
    </div>
  );
}
