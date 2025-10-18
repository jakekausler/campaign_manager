/**
 * Campaign Management Tool - Main App Component
 */

import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Campaign Management Tool</h1>
          <p className="text-muted-foreground">
            React + Vite + TypeScript + Tailwind CSS + Radix UI
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Counter Example</CardTitle>
              <CardDescription>Test hot reload functionality and Tailwind styling</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button onClick={() => setCount((c) => c + 1)}>Count is {count}</Button>
                <Button variant="outline" onClick={() => setCount(0)}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Button Variants</CardTitle>
              <CardDescription>Showcase different button styles from shadcn/ui</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="default">Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dialog Component</CardTitle>
              <CardDescription>Test Radix UI Dialog primitive integration</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Open Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Campaign Details</DialogTitle>
                    <DialogDescription>
                      This is an example dialog using Radix UI primitives with Tailwind styling.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm">
                      This dialog demonstrates proper accessibility features, animations, and
                      responsive design.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tailwind Utilities</CardTitle>
              <CardDescription>Examples of Tailwind CSS utility classes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="rounded-md bg-primary p-3 text-primary-foreground">
                  Primary Background
                </div>
                <div className="rounded-md bg-secondary p-3 text-secondary-foreground">
                  Secondary Background
                </div>
                <div className="rounded-md border p-3">Border with default background</div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground">
                All styles are applied via Tailwind CSS
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default App;
