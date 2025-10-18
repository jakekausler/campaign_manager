import { Link } from 'react-router-dom';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

/**
 * Home page component
 *
 * Landing page for the application with overview and call-to-action.
 */
export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold">Campaign Manager</h1>
        <p className="text-xl text-muted-foreground">
          Manage your tabletop RPG campaigns with ease
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Dynamic World</CardTitle>
            <CardDescription>Track world state and time</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Custom calendars, world time tracking, and dynamic computed fields for entities.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Condition System</CardTitle>
            <CardDescription>JSONLogic-based rules</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Define complex conditions and effects using powerful expression language.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events & Encounters</CardTitle>
            <CardDescription>Interactive storytelling</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create events and encounters that mutate world state when resolved.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center">
        <Link to="/auth/login">
          <Button size="lg">Get Started</Button>
        </Link>
      </div>
    </div>
  );
}
