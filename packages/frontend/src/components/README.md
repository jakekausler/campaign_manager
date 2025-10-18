# Components Directory

This directory contains all React components organized by type.

## Structure

### `/ui`

Reusable UI primitives based on Radix UI and shadcn/ui design system.

- Low-level components (buttons, inputs, dialogs, cards, etc.)
- Styled with Tailwind CSS
- Fully accessible (WAI-ARIA compliant)
- No business logic

### `/features`

Feature-specific components that contain business logic.

- Domain-specific components (e.g., CampaignCard, KingdomMap, EventTimeline)
- May use multiple UI components
- Contain state management and side effects
- Specific to application features

### `/layout`

Layout components that define page structure.

- Page layouts (MainLayout, AuthLayout, DashboardLayout)
- Navigation components (Header, Sidebar, Footer)
- Reusable layout patterns
- Handle responsive design

## Usage

```tsx
// Import UI components
import { Button, Card, Dialog } from '@/components/ui';

// Import feature components
import { CampaignCard } from '@/components/features/CampaignCard';

// Import layout components
import { MainLayout } from '@/components/layout/MainLayout';
```

## Guidelines

- UI components should be generic and reusable
- Feature components should be cohesive and focused on a single feature
- Layout components should handle structure, not business logic
- Use barrel exports (index.ts) for clean imports
- Follow Radix UI patterns for accessibility
