# Branching System

## Overview

The Branching System enables campaign managers to create alternate timeline branches, allowing "what-if" scenarios and experimentation without affecting the main campaign timeline. Each branch maintains its own version history while inheriting from its parent branch.

## Architecture

### Core Concepts

1. **Branch**: A timeline with its own version history
   - Has a name and optional description
   - May have a parent branch (forming a hierarchy)
   - Records when it diverged from its parent (`divergedAt` timestamp)

2. **Version Resolution**: Algorithm that walks up the branch ancestry to find the correct entity version
   - Checks current branch first
   - Falls back to parent branch if not found
   - Continues up the chain until a version is found or root is reached

3. **Fork Operation**: Creates a new branch by copying current entity state
   - Creates child branch with parent reference
   - Copies all entity versions at the fork point
   - Preserves entity relationships (e.g., Settlement-Structure hierarchy)

### Database Schema

The `Branch` model stores branch metadata:

```prisma
model Branch {
  id          String    @id @default(uuid())
  name        String
  description String?
  campaignId  String
  campaign    Campaign  @relation(fields: [campaignId], references: [id])
  parentId    String?
  parent      Branch?   @relation("BranchHierarchy", fields: [parentId], references: [id])
  children    Branch[]  @relation("BranchHierarchy")
  divergedAt  DateTime? // When this branch diverged from parent
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime? // Soft delete

  // Versions in this branch
  versions Version[]

  @@unique([campaignId, name])
}
```

The `Version` model tracks entity state across branches:

```prisma
model Version {
  id              String   @id @default(uuid())
  entityType      String   // 'settlement', 'structure', 'character', etc.
  entityId        String   // ID of the entity
  branchId        String   // Branch this version belongs to
  branch          Branch   @relation(fields: [branchId], references: [id])
  validFrom       DateTime // When this version becomes active
  validTo         DateTime? // When this version expires (null = current)
  compressedState Bytes    // gzip compressed JSON payload
  userId          String   // User who created this version
  createdAt       DateTime @default(now())
}
```

### Version Resolution Algorithm

The version resolution algorithm is implemented in `VersionService.resolveVersion()`:

```typescript
async resolveVersion(
  entityType: string,
  entityId: string,
  branchId: string,
  worldTime: Date
): Promise<Version | null> {
  // 1. Build branch ancestry chain (current → parent → grandparent → ...)
  const branchAncestry = await this.buildBranchAncestry(branchId);

  // 2. Search for version in each branch, starting with current
  for (const ancestorBranchId of branchAncestry) {
    const version = await prisma.version.findFirst({
      where: {
        entityType,
        entityId,
        branchId: ancestorBranchId,
        validFrom: { lte: worldTime },
        OR: [
          { validTo: null },
          { validTo: { gte: worldTime } }
        ]
      },
      orderBy: { validFrom: 'desc' }
    });

    if (version) {
      return version; // Found in this branch
    }
  }

  return null; // Not found in any branch
}
```

**Key Properties:**

- **Child branches inherit parent versions** - If a version isn't found in the child branch, it searches the parent
- **Parent isolation** - Changes in a child branch don't affect the parent
- **Sibling isolation** - Parallel branches don't see each other's changes
- **Time-aware** - Returns the version valid at the specified world time

## Backend Implementation

### BranchService

The `BranchService` provides CRUD operations and fork functionality:

**Key Methods:**

- `create(campaignId, name, description, parentId?, divergedAt?)` - Create a new branch
- `fork(sourceBranchId, name, description, worldTime, userId)` - Fork a branch (see below)
- `findById(id)` - Get branch by ID with parent/children
- `findByCampaign(campaignId)` - Get all branches for a campaign
- `getHierarchy(campaignId)` - Get branch tree structure
- `getAncestry(branchId)` - Get ancestor chain for resolution
- `update(id, input)` - Update branch name/description
- `delete(id)` - Soft delete a branch

#### Fork Operation Details

The fork operation (`BranchService.fork()`) creates an alternate timeline:

1. **Create child branch** with `parentId` and `divergedAt` timestamp
2. **Copy all entity versions** at the fork point for 10 entity types:
   - Campaign, World, Location, Character, Party, Kingdom, Settlement, Structure, Encounter, Event
3. **Preserve relationships** - Settlement-Structure hierarchy maintained
4. **Transaction-wrapped** - Rollback on any failure
5. **Optimized performance**:
   - Branch ancestry filtering (only copies from source branch chain)
   - Batch resolution with `Promise.all` (avoids N+1 queries)
   - Reuses compressed payloads directly (no decompression/recompression)

**Returns:** `ForkResult` interface:

```typescript
interface ForkResult {
  branch: Branch; // The newly created child branch
  versionsCopied: number; // Count of versions copied
}
```

### GraphQL API

The `BranchResolver` exposes branch operations via GraphQL:

**Queries:**

```graphql
type Query {
  # Get a single branch by ID
  branch(id: ID!): Branch

  # Get all branches for a campaign (flat list)
  branches(campaignId: ID!): [Branch!]!

  # Get branch hierarchy (tree structure)
  branchHierarchy(campaignId: ID!): [BranchNode!]!
}

type Branch {
  id: ID!
  name: String!
  description: String
  campaign: Campaign!
  parent: Branch
  children: [Branch!]!
  divergedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type BranchNode {
  branch: Branch!
  children: [BranchNode!]! # Recursive tree structure
}
```

**Mutations:**

```graphql
type Mutation {
  # Create a new branch (optionally as child of another)
  createBranch(input: CreateBranchInput!): Branch!

  # Update branch metadata (name/description only)
  updateBranch(id: ID!, input: UpdateBranchInput!): Branch!

  # Soft delete a branch
  deleteBranch(id: ID!): Boolean!

  # Fork a branch (create child with version copying)
  forkBranch(input: ForkBranchInput!): ForkResult!
}

input CreateBranchInput {
  campaignId: ID!
  name: String!
  description: String
  parentId: ID
  divergedAt: DateTime
}

input UpdateBranchInput {
  name: String
  description: String
}

input ForkBranchInput {
  sourceBranchId: ID!
  name: String!
  description: String
  worldTime: DateTime! # Fork point in campaign time
}

type ForkResult {
  branch: Branch!
  versionsCopied: Int!
}
```

**Authorization:**

- All operations check campaign membership
- Only campaign members can view/modify branches
- Unauthorized access throws `ForbiddenException`

### Entity Services Integration

Settlement and Structure services support branch-aware queries:

```typescript
// SettlementService
async getSettlementAsOf(
  id: string,
  branchId: string,
  worldTime: Date
): Promise<Settlement | null> {
  const version = await this.versionService.resolveVersion(
    'settlement',
    id,
    branchId,
    worldTime
  );

  if (!version) return null;

  const payload = await this.versionService.decompressPayload(version.compressedState);
  return this.mapPayloadToSettlement(id, payload);
}
```

**GraphQL Resolvers:**

```graphql
type Query {
  # Get settlement state at specific time in specific branch
  settlementAsOf(id: ID!, branchId: ID!, asOf: DateTime!): Settlement

  # Same for structures
  structureAsOf(id: ID!, branchId: ID!, asOf: DateTime!): Structure
}
```

## Frontend Implementation

### Branch Context Management

The Zustand campaign store manages per-campaign branch state:

```typescript
interface CampaignState {
  currentBranchId: string | null;
  campaignBranchMap: Record<string, string>; // campaignId → branchId
  setCurrentBranch: (branchId: string) => void;
  setCurrentCampaign: (campaign: Campaign) => void;
}

// When switching campaigns, restore the per-campaign branch
setCurrentCampaign: (campaign) => {
  set({ currentCampaign: campaign });

  // Restore branch for this campaign
  const branchId = get().campaignBranchMap[campaign.id];
  if (branchId) {
    set({ currentBranchId: branchId });
  }
};

// When switching branches, persist to map
setCurrentBranch: (branchId) => {
  const campaign = get().currentCampaign;
  if (campaign) {
    set((state) => ({
      currentBranchId: branchId,
      campaignBranchMap: {
        ...state.campaignBranchMap,
        [campaign.id]: branchId,
      },
    }));
  }
};
```

**Persistence:** The `campaignBranchMap` is persisted to localStorage via Zustand middleware, ensuring branch selections survive page reloads.

### BranchSelector Component

Location: `packages/frontend/src/components/features/branches/BranchSelector.tsx`

A Sheet/drawer component for viewing and switching branches:

**Features:**

- Hierarchical display with indentation (12px base + depth \* 24px)
- Shows branch metadata: divergedAt, description, creation date
- Current branch indicated with `aria-current="page"`
- Loading, error, and empty states
- Mobile-friendly Sheet UI (instead of dropdown)
- Integrated into MainLayout header (shown when campaign selected)

**User Actions:**

- Click branch name to switch to that branch
- Click "Fork" button to open fork dialog

**GraphQL Integration:**

```typescript
const { data, loading, error } = useGetBranchHierarchy(campaignId);
const [setCurrentBranch] = useSetCurrentBranch();

// Switch branches
const handleBranchClick = (branchId: string) => {
  setCurrentBranch(branchId);
  // Sheet closes automatically
};
```

### ForkBranchDialog Component

Location: `packages/frontend/src/components/features/branches/ForkBranchDialog.tsx`

Modal dialog for creating alternate timeline branches:

**Form Inputs:**

- **Name** (required) - Branch name
- **Description** (optional) - Branch description
- **Source Branch** (read-only) - Current branch being forked
- **Divergence Point** (read-only) - Current world time

**User Experience:**

- Shows progress during fork operation: "Copying versions..."
- Success message: "Fork created successfully. X versions copied."
- Automatically switches to new branch after creation
- Refetches branch hierarchy to show new branch
- Keyboard shortcuts: Enter to submit, Escape to cancel
- Form validation prevents submission with empty name
- Loading state disables all inputs and prevents dialog close

**Error Handling:**

- GraphQL mutation errors displayed clearly
- Validation: name required, source branch exists, world time available
- Whitespace trimming on inputs

### BranchHierarchyView Component

Location: `packages/frontend/src/components/features/branches/BranchHierarchyView.tsx`

Interactive tree visualization using React Flow:

**Features:**

- **Hierarchical Layout** - Uses dagre for automatic node positioning
- **Custom Branch Nodes** - Display name, description, diverged/created dates
- **Current Branch Highlight** - Primary border + "Current" badge
- **Click to Switch** - Click any node to switch to that branch
- **Search/Filter** - Case-insensitive search on name and description
- **Interactive Controls**:
  - Pan and zoom for large trees
  - Minimap for navigation
  - Background grid for visual reference
- **Hover Actions** - Fork, rename, delete (disabled until Stage 10)
- **Accessibility** - ARIA labels, proper input labeling, screen reader support

**Integration:**

- Displayed on `/branches` page (lazy loaded route)
- Uses `useGetBranchHierarchy` hook
- Synced with campaign store for current branch highlighting

### BranchComparisonView Component

Location: `packages/frontend/src/components/features/branches/BranchComparisonView.tsx`

Side-by-side diff view for comparing entity states between branches:

**Features:**

- **Branch Selectors** - Choose source and target branches
- **Entity Selector** - Choose entity type (Settlement, Structure) and ID
- **World Time Input** - Specify comparison time (ISO 8601 format)
- **Smart Defaults** - Auto-populates with parent vs current branch at current world time
- **Visual Diff** - Uses `react-diff-viewer-continued` with syntax highlighting
- **Help Text** - Guidance on finding entity IDs and using the comparison

**Form Controls:**

- Source/Target branch dropdowns (populated from campaign branches)
- Entity type dropdown (Settlement, Structure)
- Entity ID text input
- World time datetime-local input
- Compare button (triggers GraphQL queries)
- Clear button (resets form)

**GraphQL Integration:**

```typescript
const { data: sourceData, loading: sourceLoading } = useGetSettlementAsOf(
  entityId,
  sourceBranchId,
  worldTime,
  { skip: !shouldFetch }
);

const { data: targetData, loading: targetLoading } = useGetSettlementAsOf(
  entityId,
  targetBranchId,
  worldTime,
  { skip: !shouldFetch }
);
```

**Error Handling:**

- Loading states for both queries
- Error alerts for query failures
- Empty state warnings when no data found
- Validation messages for missing inputs

## Usage Examples

### Example 1: Creating a "What-If" Scenario

A GM wants to explore what happens if the party chooses a different path:

1. **Current State** (Main Branch):
   - Settlement population: 1000
   - Castle defense: 50

2. **Fork Branch** at current world time:

   ```graphql
   mutation {
     forkBranch(
       input: {
         sourceBranchId: "main-branch-id"
         name: "Attack the Dragon"
         description: "Timeline where party attacks dragon instead of negotiating"
         worldTime: "2025-06-15T12:00:00Z"
       }
     ) {
       branch {
         id
         name
       }
       versionsCopied
     }
   }
   ```

3. **Make Changes in Fork**:
   - Reduce population to 800 (casualties)
   - Increase defense to 60 (spoils of war)

4. **Compare Outcomes**:
   - Use BranchComparisonView to see differences
   - Main: population=1000, defense=50
   - Fork: population=800, defense=60

5. **Decision**:
   - Keep main branch (negotiation path)
   - Or switch to fork if preferred

### Example 2: Historical Branching

Track major decision points in campaign history:

```
main
├── negotiation-path (current)
│   ├── alliance-formed
│   └── treaty-signed
└── war-path
    ├── siege-victory
    └── kingdom-conquered
```

Each branch preserves the complete game state at its divergence point, allowing GMs to revisit or continue any timeline.

### Example 3: Multi-Level Inheritance

```
main (pop=1000)
├── scenario-a (pop=1200)  # Inherits main, then overrides
│   └── scenario-a1 (pop=1500)  # Inherits scenario-a, then overrides
└── scenario-b (pop=800)   # Inherits main, then overrides
```

Version resolution correctly walks the ancestry:

- `scenario-a1` at any time: returns pop=1500 (if set), else pop=1200 (from parent), else pop=1000 (from grandparent)
- `scenario-b` never sees `scenario-a` or `scenario-a1` changes (sibling isolation)

## Performance Considerations

### Fork Operation Optimization

The fork operation is optimized for large datasets:

1. **Branch Ancestry Filtering** - Only copies versions from source branch chain
   - Prevents copying unrelated versions from sibling branches
   - Reduces database queries significantly

2. **Batch Resolution** - Uses `Promise.all` for parallel processing
   - Resolves all versions concurrently
   - Avoids N+1 query pattern

3. **Payload Reuse** - Directly copies compressed payloads
   - No decompression/recompression overhead
   - Preserves gzip compression for storage efficiency

4. **Transaction Wrapper** - Ensures atomic operation
   - Rollback on any failure
   - Database consistency maintained

### Version Resolution Performance

Version resolution is optimized with:

1. **Indexed Queries** - Database indexes on:
   - `(branchId, entityType, entityId, validFrom)`
   - `(branchId, entityType, validFrom)`

2. **Ancestry Caching** - Branch ancestry chains cached in memory
   - Reduces repeated database queries
   - Cleared on branch modification

3. **Query Optimization** - `findFirst` with `orderBy` for single query
   - No need for multiple round trips
   - Returns immediately when version found

## Testing Strategy

### Unit Tests

**BranchService Tests** (`branch.service.test.ts`):

- CRUD operations (create, read, update, delete)
- Hierarchy retrieval and ancestry walking
- Validation rules (circular refs, delete with children)
- Fork operation with version copying
- Branch ancestry filtering
- Transaction rollback on error

**VersionService Tests** (existing):

- Version resolution across branch hierarchy
- Compression/decompression
- Time-based querying

### Integration Tests

**Settlement/Structure Branch Versioning** (`settlement-structure-branch-versioning.integration.test.ts`):

- Version resolution from main branch
- Child branch inheritance
- Parent isolation (child changes don't affect parent)
- 3-level hierarchy resolution
- Authorization checks

**Branch Resolver E2E** (`branch.resolver.integration.test.ts`):

- GraphQL queries (branch, branches, branchHierarchy)
- GraphQL mutations (create, update, delete, fork)
- Authorization enforcement
- Error handling

### E2E Tests

**Branching System E2E** (`branching-system.e2e.test.ts`):

- Complete fork workflow (campaign → branch → fork → verify)
- Version resolution across 4+ levels of hierarchy
- Settlement-Structure hierarchy preservation
- Concurrent edits in different branches
- Branch ancestry inheritance and isolation
- Parallel branch hierarchies

### Frontend Tests

**Component Tests** (Vitest):

- BranchSelector: display, selection, integration (12 tests)
- ForkBranchDialog: form, submission, error handling (34 tests)
- BranchHierarchyView: rendering, interaction, search (22 tests)
- BranchComparisonView: form, comparison, errors (24 tests)

**Total Test Coverage:** 92 tests covering backend + frontend

## Future Enhancements (Stage 10 & Beyond)

### Stage 10: Polish & Edge Cases

- Branch deletion safeguards (confirmation, cascade policy)
- Branch rename validation (conflict detection)
- Branch metadata (favorites, colors, tags)
- Branch permissions based on campaign roles
- Orphaned branch handling
- Optimistic UI updates
- Keyboard shortcuts (Ctrl+B, Ctrl+Shift+F)

### Future Tickets

- **Branch Merging** (TICKET-028) - Merge changes from one branch into another
- **Conflict Resolution** - UI for resolving conflicts during merge
- **Branch Templates** - Create branches from predefined templates
- **Automatic Branching** - Auto-create branches on major events
- **Branch Analytics** - Divergence metrics, activity tracking

## Troubleshooting

### Common Issues

**Issue:** Fork operation slow with many entities

- **Solution:** Fork operation already optimized with batch resolution and payload reuse
- **Future:** Consider background job for very large forks (1000+ entities)

**Issue:** Version not found in branch

- **Check:** Is the entity version created at or before the query time?
- **Check:** Is the entity version in the branch or its ancestry?
- **Debug:** Use `versionService.buildBranchAncestry(branchId)` to see ancestry chain

**Issue:** Child branch seeing parent changes after fork

- **This is expected behavior:** Child branches inherit parent versions if no override exists
- **If unwanted:** Create version in child branch to override parent

**Issue:** Branch hierarchy visualization slow with many branches

- **Solution:** React Flow already optimized with virtual rendering
- **Future:** Pagination or lazy loading for 100+ branches

### Debugging Tips

1. **Check Branch Ancestry**: Use GraphQL `branchHierarchy` query to visualize tree
2. **Verify Version Times**: Ensure `validFrom` is correct for your query time
3. **Test Version Resolution**: Query specific branch and time to see what resolves
4. **Check Authorization**: Ensure user is campaign member
5. **Review Audit Logs**: Fork operations logged with 'FORK' audit operation type

## API Reference

See [GraphQL Schema](../api/graphql-schema.md) for complete API documentation.

## Related Documentation

- [Versioning System](./versioning-system.md) - Core version resolution algorithm
- [Settlement Management](./settlement-management.md) - Settlement entity operations
- [Structure Management](./structure-management.md) - Structure entity operations
- [World Time System](./world-time-system.md) - Campaign time tracking
- [Audit Logging](./audit-logging.md) - Change tracking and history
