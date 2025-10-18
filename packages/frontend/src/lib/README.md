# Lib Directory

This directory contains third-party library configurations and integrations.

## Purpose

The lib directory is for:

- Third-party library setup and configuration
- Wrapper functions for external libraries
- Integration code that adapts external APIs to our application
- Library-specific utilities (different from general utils)

## Current Contents

### `utils.ts`

Contains the `cn()` utility function for merging Tailwind CSS classes.

- Uses `clsx` for conditional class names
- Uses `tailwind-merge` for deduplicating Tailwind classes
- Essential for component styling with Tailwind

## Structure

```
lib/
├── utils.ts             # Tailwind class merging utility
├── apollo.ts            # Apollo Client configuration (future)
├── react-query.ts       # React Query setup (future)
└── index.ts             # Barrel export
```

## Usage

```tsx
import { cn } from '@/lib/utils';

function Button({ className, ...props }) {
  return <button className={cn('px-4 py-2 rounded bg-blue-500', className)} {...props} />;
}
```

## Guidelines

- Keep third-party library code separate from application utils
- Configure libraries with sensible defaults
- Export configured instances (e.g., Apollo Client, Axios instance)
- Document any non-obvious configurations
- Version lock critical dependencies

## Lib vs Utils

- **Lib**: Third-party integrations, library configurations, wrappers
- **Utils**: Pure functions, application-specific helpers, no external dependencies
