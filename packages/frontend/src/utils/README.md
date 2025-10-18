# Utils Directory

This directory contains pure utility functions and helper methods.

## Purpose

Utils are stateless, reusable functions that:

- Transform or format data
- Perform calculations or validations
- Provide common algorithms or operations
- Have no side effects (pure functions)
- Are independent of React or application state

## Guidelines

- Keep functions pure (same input → same output)
- No side effects (no mutations, API calls, or state changes)
- Well-typed with TypeScript
- Documented with JSDoc comments
- Unit tested for reliability
- One function per file or grouped by domain

## Structure

```
utils/
├── date.ts              # Date formatting and manipulation
├── validation.ts        # Input validation helpers
├── string.ts            # String manipulation utilities
├── math.ts              # Mathematical calculations
├── cn.ts                # Class name merging (already in lib/)
└── index.ts             # Barrel export
```

## Usage

```tsx
import { formatDate, calculateDistance, validateEmail } from '@/utils';

function CampaignCard({ campaign }) {
  const formattedDate = formatDate(campaign.createdAt, 'MMM dd, yyyy');
  const isValid = validateEmail(campaign.ownerEmail);

  // Component logic...
}
```

## Examples

```typescript
// date.ts
export function formatDate(date: Date, format: string): string {
  // Implementation...
}

// validation.ts
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// string.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

## Utils vs Hooks

- **Utils**: Pure functions, no React dependencies, stateless
- **Hooks**: Stateful logic, React-specific, use React features
