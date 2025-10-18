# Router Configuration

This directory contains the React Router v6 configuration for the application.

## Purpose

Defines application routes, navigation structure, and code splitting boundaries.

## Structure

```
router/
├── index.tsx           # Main router configuration with route definitions
├── ProtectedRoute.tsx  # Higher-order component for authenticated routes
└── README.md          # This file
```

## Usage

### Importing the Router

```tsx
// src/main.tsx or src/App.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';

function App() {
  return <RouterProvider router={router} />;
}
```

### Adding New Routes

1. Create the page component in `src/pages/`
2. Add lazy import in `router/index.tsx`:
   ```tsx
   const NewPage = lazy(() => import('@/pages/NewPage'));
   ```
3. Add route definition to the appropriate layout:
   ```tsx
   {
     path: 'new-page',
     element: (
       <LazyPage>
         <NewPage />
       </LazyPage>
     ),
   }
   ```

### Protected Routes

Wrap routes requiring authentication with `<ProtectedRoute>`:

```tsx
{
  path: 'dashboard',
  element: (
    <ProtectedRoute>
      <LazyPage>
        <DashboardPage />
      </LazyPage>
    </ProtectedRoute>
  ),
}
```

## Features

### Code Splitting

All pages are lazy-loaded using React's `lazy()` and `Suspense`:

- Reduces initial bundle size
- Improves time to interactive
- Loads route code only when needed

### Nested Layouts

Routes are organized under layout components:

- `MainLayout`: Public pages with navigation
- `AuthLayout`: Authentication pages (login, register)

### Protected Routes

`ProtectedRoute` component handles:

- Authentication checks
- Redirect to login if unauthenticated
- Automatic redirect after login

### 404 Handling

Catch-all route (`path: '*'`) renders NotFoundPage for invalid URLs.

## Route Structure

```
/ (MainLayout)
├── / (HomePage)
├── /dashboard (DashboardPage, protected)

/auth (AuthLayout)
├── /auth (redirects to /auth/login)
├── /auth/login (LoginPage)

* (NotFoundPage)
```

## Guidelines

### Route Organization

- **Public routes**: Under `/` with MainLayout
- **Auth routes**: Under `/auth` with AuthLayout
- **Protected routes**: Wrap with `<ProtectedRoute>`
- **Admin routes**: Consider `/admin` prefix with AdminLayout

### Path Naming

- Use lowercase kebab-case: `/user-profile`
- Avoid trailing slashes: `/dashboard` not `/dashboard/`
- Use index routes for default children

### Dynamic Routes

```tsx
{
  path: 'campaigns/:campaignId',
  element: <LazyPage><CampaignDetailPage /></LazyPage>,
}
```

Access params in component:

```tsx
import { useParams } from 'react-router-dom';

const { campaignId } = useParams<{ campaignId: string }>();
```

### Navigation

```tsx
import { Link, useNavigate } from 'react-router-dom';

// Declarative
<Link to="/dashboard">Dashboard</Link>;

// Programmatic
const navigate = useNavigate();
navigate('/dashboard');
```

## Best Practices

1. **Always use lazy loading** for route components
2. **Wrap lazy components** with `<LazyPage>` for consistent loading states
3. **Use absolute paths** starting with `/` for predictability
4. **Keep route config flat** - avoid deep nesting (max 2-3 levels)
5. **Use index routes** for default children instead of redirects when possible
6. **Type your params** with `useParams<{ id: string }>()`

## Examples

### Adding a Settings Page

```tsx
// 1. Create the page component
// src/pages/SettingsPage.tsx
export default function SettingsPage() {
  return <div>Settings</div>;
}

// 2. Add lazy import in router/index.tsx
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

// 3. Add route definition
{
  path: 'settings',
  element: (
    <ProtectedRoute>
      <LazyPage>
        <SettingsPage />
      </LazyPage>
    </ProtectedRoute>
  ),
}
```

### Adding Nested Routes

```tsx
{
  path: 'campaigns',
  children: [
    {
      index: true,
      element: <LazyPage><CampaignListPage /></LazyPage>,
    },
    {
      path: ':campaignId',
      element: <LazyPage><CampaignDetailPage /></LazyPage>,
    },
    {
      path: 'new',
      element: <LazyPage><CampaignCreatePage /></LazyPage>,
    },
  ],
}
```

## Related Documentation

- [React Router v6 Docs](https://reactrouter.com/)
- [Code Splitting with React.lazy](https://react.dev/reference/react/lazy)
- [src/pages/README.md](../pages/README.md) - Page component guidelines
- [src/components/layout/README.md](../components/README.md) - Layout components
