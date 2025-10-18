# Types Directory

This directory contains shared TypeScript type definitions and interfaces.

## Purpose

Centralized type definitions for:

- Domain models (Campaign, Kingdom, Settlement, etc.)
- API request/response types
- Component prop types (when shared across multiple components)
- Utility types and type helpers
- Enum definitions

## Structure

```
types/
├── models/
│   ├── campaign.ts      # Campaign model types
│   ├── kingdom.ts       # Kingdom model types
│   ├── settlement.ts    # Settlement model types
│   └── user.ts          # User model types
├── api/
│   ├── requests.ts      # API request types
│   └── responses.ts     # API response types
├── common.ts            # Common utility types
└── index.ts             # Barrel export
```

## Usage

```tsx
import type { Campaign, Kingdom, User } from '@/types';
import type { ApiResponse, PaginatedResponse } from '@/types/api';

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
}
```

## Guidelines

- Use `type` for unions, primitives, and tuples
- Use `interface` for object shapes (can be extended)
- Export all types as named exports
- Use descriptive names (avoid generic names like `Data` or `Item`)
- Document complex types with JSDoc comments
- Prefer type inference over explicit typing when obvious
- Use `Readonly` for immutable types
- Avoid `any` - use `unknown` if type is truly unknown

## Example Types

```typescript
// types/models/campaign.ts
export interface Campaign {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CampaignStatus = 'active' | 'archived' | 'paused';

export interface CreateCampaignInput {
  name: string;
  description?: string;
}

// types/api/responses.ts
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// types/common.ts
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type ID = string;
```

## Type Generation

For GraphQL types, consider using code generation tools:

- `@graphql-codegen/cli` - Generate types from GraphQL schema
- Configure in a separate `codegen.yml` file
- Generated types should live in a separate directory (e.g., `types/generated/`)
