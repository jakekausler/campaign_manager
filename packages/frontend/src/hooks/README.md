# Hooks Directory

This directory contains custom React hooks for reusable stateful logic.

## Purpose

Custom hooks encapsulate and share stateful logic across components:

- Abstract complex state management
- Share side effects and lifecycle logic
- Provide reusable interfaces to data and services
- Simplify component code by extracting logic

## Naming Convention

All custom hooks must start with `use` (React convention):

- `useAuth` - Authentication state and actions
- `useCampaign` - Campaign data fetching and mutations
- `useWorldTime` - World time state management
- `useDebounce` - Debounce value changes
- `useLocalStorage` - Persist state to localStorage

## Structure

```
hooks/
├── useAuth.ts           # Authentication hook
├── useCampaign.ts       # Campaign data hook
├── useWorldTime.ts      # World time hook
├── useDebounce.ts       # Debounce hook
├── useLocalStorage.ts   # LocalStorage hook
└── index.ts             # Barrel export
```

## Usage

```tsx
import { useAuth, useCampaign } from '@/hooks';

function CampaignDetail() {
  const { user, isAuthenticated } = useAuth();
  const { campaign, loading, error } = useCampaign(campaignId);

  // Component logic...
}
```

## Guidelines

- One hook per file
- Name file same as hook (useAuth → useAuth.ts)
- Export hook as named export
- Add JSDoc comments explaining parameters and return values
- Keep hooks focused on a single responsibility
- Return objects for multiple values (not arrays)
- Handle loading and error states internally when appropriate
- Use TypeScript for type safety
