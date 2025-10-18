import { useNavigate } from 'react-router-dom';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';

/**
 * Dashboard page component (protected route)
 *
 * Main hub for authenticated users to manage their campaigns.
 */
export default function DashboardPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // TODO: Replace with actual logout API call
    localStorage.removeItem('auth_token');
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to your campaigns</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          Log Out
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>My Campaigns</CardTitle>
            <CardDescription>0 active campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No campaigns yet. Create your first campaign to get started.
            </p>
            <Button className="mt-4" disabled>
              Create Campaign
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No recent activity to display.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full" disabled>
              Create Event
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Create Encounter
            </Button>
            <Button variant="outline" className="w-full" disabled>
              Manage Settlements
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Follow these steps to set up your first campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              <li>Create a new campaign with custom world settings</li>
              <li>Define your world calendar and starting time</li>
              <li>Add settlements, structures, and parties</li>
              <li>Create conditions and effects for dynamic world state</li>
              <li>Plan events and encounters for your players</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
