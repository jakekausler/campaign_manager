import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { generateUUID } from '@/utils';

/**
 * Login page component
 *
 * Handles user authentication and redirects to intended destination.
 * TODO: Integrate with actual authentication API
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Get the page user was trying to access, or default to dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Replace with actual authentication API call
    // const formData = new FormData(e.currentTarget);
    // const email = formData.get('email') as string;
    // const password = formData.get('password') as string;
    // await authService.login(email, password);

    // Placeholder: Set mock token after delay
    // Using generateUUID() utility which handles crypto.randomUUID() fallback automatically
    setTimeout(() => {
      const mockToken = `mock-${generateUUID()}`;
      localStorage.setItem('auth_token', mockToken);
      setIsLoading(false);
      navigate(from, { replace: true });
    }, 1000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your credentials to access your campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Demo credentials will be available soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
