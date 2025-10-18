# Pages Directory

This directory contains top-level page components that represent entire routes.

## Purpose

Pages are the entry points for routes in the application. Each page:

- Corresponds to a specific route (e.g., `/dashboard`, `/campaigns/:id`)
- Uses layout components to define page structure
- Composes feature and UI components to build the page
- Handles route-specific data fetching and state
- May use React Router hooks (useParams, useNavigate, etc.)

## Structure

Pages should be organized by feature or section:

```
pages/
├── Home.tsx              # Landing page (/)
├── Login.tsx             # Login page (/login)
├── Dashboard.tsx         # Dashboard page (/dashboard)
├── campaigns/
│   ├── CampaignList.tsx  # Campaign list (/campaigns)
│   ├── CampaignDetail.tsx # Campaign detail (/campaigns/:id)
│   └── CampaignCreate.tsx # Create campaign (/campaigns/new)
└── NotFound.tsx          # 404 page
```

## Usage

```tsx
// In router configuration
import { Home } from '@/pages/Home';
import { Dashboard } from '@/pages/Dashboard';
import { CampaignDetail } from '@/pages/campaigns/CampaignDetail';

const routes = [
  { path: '/', element: <Home /> },
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/campaigns/:id', element: <CampaignDetail /> },
];
```

## Guidelines

- Keep pages focused on layout and composition
- Move reusable logic to hooks or services
- Use feature components for domain-specific functionality
- Handle loading and error states
- Implement lazy loading for better performance
- Use descriptive names that match routes
