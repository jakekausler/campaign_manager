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

## Branch Merging & Conflict Resolution

The merge system enables combining changes from different branches, with automatic conflict detection and resolution UI. Completed in **TICKET-028**.

### Merge Algorithm: 3-Way Merge

The system uses a **3-way merge algorithm** to intelligently detect conflicts:

```
Common Ancestor (Base)
       ↓
    Divergence
    /        \
Source       Target
Branch       Branch
```

**Key Concepts:**

1. **Common Ancestor (Base)** - The state where branches diverged (merge base)
2. **Source Branch** - Branch being merged from (changes to apply)
3. **Target Branch** - Branch being merged into (destination)
4. **Auto-Resolution** - If only one branch modified a property, use that value
5. **Conflict** - Both branches modified the same property → requires manual resolution

**Algorithm:**

For each entity property path (e.g., `settlement.population`, `resources.gold`):

```typescript
if (source === target) {
  // Both made identical changes
  resolved = source; // Auto-resolve
} else if (base === source && base !== target) {
  // Only target changed
  resolved = target; // Auto-resolve
} else if (base === target && base !== source) {
  // Only source changed
  resolved = source; // Auto-resolve
} else if (base !== source && base !== target) {
  // Both changed differently
  CONFLICT; // Requires manual resolution
}
```

### Backend: MergeService

Location: `packages/api/src/graphql/services/merge.service.ts`

#### Core Methods

**`findCommonAncestor(sourceBranchId, targetBranchId)`**

Finds the merge base using O(n+m) ancestry walking algorithm:

```typescript
// Build ancestry chains
const sourceAncestry = await buildBranchAncestry(sourceBranchId);
const targetAncestry = await buildBranchAncestry(targetBranchId);

// Find first common branch using Set for O(1) lookups
const targetSet = new Set(targetAncestry);
for (const ancestorId of sourceAncestry) {
  if (targetSet.has(ancestorId)) {
    return ancestorId; // Common ancestor found
  }
}
```

**`executeMerge(input: ExecuteMergeInput)`**

Two-pass merge execution for efficiency and correctness:

```typescript
// PASS 1: Analyze all entities, detect conflicts
const entities = await discoverEntitiesForMerge(sourceBranch, targetBranch);
const conflicts: MergeConflict[] = [];
const mergeData: Map<string, any> = new Map();

for (const entity of entities) {
  const versions = await getEntityVersionsForMerge(/* ... */);
  const result = await compareVersions(versions.base, versions.source, versions.target);

  if (result.conflicts.length > 0) {
    conflicts.push(...result.conflicts);
  }
  mergeData.set(entity.key, result.mergedPayload);
}

// Validate ALL conflicts resolved before any DB writes
const unresolved = findUnresolvedConflicts(conflicts, resolutions);
if (unresolved.length > 0) {
  throw new BadRequestException('Not all conflicts resolved');
}

// PASS 2: Create versions atomically (transaction-wrapped)
await prisma.$transaction(async (tx) => {
  for (const [key, payload] of mergeData) {
    await tx.version.create({
      data: {
        entityType,
        entityId,
        branchId: targetBranch.id,
        validFrom: worldTime,
        compressedState: await compressPayload(payload),
        userId,
      },
    });
  }

  // Record merge history for audit trail
  await tx.mergeHistory.create({
    data: {
      sourceBranchId,
      targetBranchId,
      mergedAt: worldTime,
      userId,
      entitiesMergedCount: mergeData.size,
      conflictsResolvedCount: conflicts.length,
      resolutionsData: resolutions,
    },
  });
});
```

**`cherryPickVersion(versionId, targetBranchId, resolutions?)`**

Selectively applies a specific version to another branch using 2-way conflict detection:

```typescript
// Cherry-pick uses empty base for 2-way conflict detection
const basePayload = {}; // No common ancestor for cherry-pick
const sourcePayload = await decompressPayload(version.compressedState);
const targetPayload = await getCurrentPayloadInBranch(
  targetBranch,
  version.entityType,
  version.entityId
);

const result = await compareVersions(basePayload, sourcePayload, targetPayload);

if (result.conflicts.length === 0) {
  // Auto-apply when no conflicts
  await createVersion(targetBranch, version.entityType, version.entityId, sourcePayload);
  return { success: true, versionId: newVersion.id };
} else {
  // Return conflicts for manual resolution
  return { success: false, conflicts: result.conflicts };
}
```

#### Conflict Detection Classes

**ConflictDetector** (Base)

Generic conflict detection for all entity types:

- Recursive path traversal for nested properties (e.g., `resources.gold.amount`)
- Deep equality checking (objects, arrays, primitives)
- JSON path notation for precise conflict identification
- Auto-resolution logic for non-conflicting changes

**SettlementMergeHandler**

Extends ConflictDetector with Settlement-specific semantics:

- Domain-specific conflict descriptions (e.g., "Population changed from 1000 to 800")
- Resolution suggestions (e.g., "Consider averaging population values")
- Handles all Settlement properties: name, level, kingdom, location, variables

**StructureMergeHandler**

Extends ConflictDetector with Structure-specific semantics:

- Domain-specific conflict descriptions (e.g., "Defense rating increased by 20")
- Resolution suggestions (e.g., "Use higher defense value for safety")
- Handles all Structure properties: name, type, settlement, level, status, variables

### Database Schema: MergeHistory

```prisma
model MergeHistory {
  id                     String   @id @default(uuid())
  sourceBranchId         String
  sourceBranch           Branch   @relation("MergeHistorySource", fields: [sourceBranchId], references: [id])
  targetBranchId         String
  targetBranch           Branch   @relation("MergeHistoryTarget", fields: [targetBranchId], references: [id])
  mergedAt               DateTime // World time when merge occurred
  userId                 String
  entitiesMergedCount    Int
  conflictsResolvedCount Int
  resolutionsData        Json     // Manual conflict resolutions applied
  metadata               Json?    // Additional merge metadata
  createdAt              DateTime @default(now())

  @@index([sourceBranchId])
  @@index([targetBranchId])
  @@index([mergedAt])
}
```

### GraphQL API: Merge Operations

**Queries:**

```graphql
type Query {
  # Preview merge before execution (shows conflicts)
  previewMerge(input: PreviewMergeInput!): MergePreview!

  # Get merge history for a branch
  getMergeHistory(branchId: ID!): [MergeHistoryEntry!]!
}

input PreviewMergeInput {
  sourceBranchId: ID!
  targetBranchId: ID!
  worldTime: DateTime!
}

type MergePreview {
  sourceBranch: Branch!
  targetBranch: Branch!
  commonAncestor: Branch
  entities: [EntityMergePreview!]!
  requiresManualResolution: Boolean!
}

type EntityMergePreview {
  entityType: String!
  entityId: String!
  conflicts: [MergeConflict!]!
  autoResolvedChanges: [AutoResolvedChange!]!
}

type MergeConflict {
  path: String! # JSON path (e.g., "resources.gold")
  type: ConflictType!
  baseValue: JSON
  sourceValue: JSON
  targetValue: JSON
  description: String!
  suggestion: String
}

enum ConflictType {
  BOTH_MODIFIED
  MODIFIED_DELETED
  DELETED_MODIFIED
  BOTH_DELETED
}

type AutoResolvedChange {
  path: String!
  oldValue: JSON
  newValue: JSON
  reason: String!
}

type MergeHistoryEntry {
  id: ID!
  sourceBranch: BranchInfo!
  targetBranch: BranchInfo!
  mergedAt: DateTime!
  userId: String!
  entitiesMergedCount: Int!
  conflictsResolvedCount: Int!
  resolutionsData: JSON
  metadata: JSON
  createdAt: DateTime!
}
```

**Mutations:**

```graphql
type Mutation {
  # Execute merge with conflict resolutions
  executeMerge(input: ExecuteMergeInput!): MergeResult!

  # Cherry-pick a specific version to another branch
  cherryPickVersion(input: CherryPickVersionInput!): CherryPickResult!
}

input ExecuteMergeInput {
  sourceBranchId: ID!
  targetBranchId: ID!
  worldTime: DateTime!
  resolutions: [ConflictResolution!]
}

input ConflictResolution {
  entityType: String!
  entityId: String!
  path: String!
  resolvedValue: JSON!
}

type MergeResult {
  success: Boolean!
  entitiesMerged: Int!
  conflictsResolved: Int!
  errors: [String!]
}

input CherryPickVersionInput {
  versionId: ID!
  targetBranchId: ID!
  resolutions: [ConflictResolution!]
}

type CherryPickResult {
  success: Boolean!
  versionId: String
  conflicts: [MergeConflict!]
  error: String
}
```

**Authorization:**

- `previewMerge` requires campaign access
- `executeMerge` requires GM/OWNER role
- `cherryPickVersion` requires GM/OWNER role
- `getMergeHistory` requires campaign access

### Frontend: Merge UI Components

#### MergePreviewDialog

Location: `packages/frontend/src/components/features/branches/MergePreviewDialog.tsx`

Comprehensive merge preview with conflict visualization:

**Features:**

- **Source/Target Display** - Visual color coding (blue/green) with branch names
- **Summary Statistics** - Total entities, conflicts count, auto-resolved count
- **Tabbed Interface** - Separates "Conflicts" (red) from "Auto-Resolved" (green)
- **Expandable Conflict Details** - 3-way diff showing Base/Source/Target values
- **Expandable Auto-Resolved Details** - 4-way diff showing Base/Source/Target/Resolved
- **Entity Grouping** - Changes grouped by entity with expand/collapse
- **JSON Path Display** - Shows exact property paths (e.g., `resources.gold`)
- **Human-Readable Descriptions** - Explains what changed and why
- **Resolution Suggestions** - Guides users toward correct resolution
- **Action Buttons** - "Proceed to Resolve" (if conflicts) or "Execute Merge" (if clean)

**GraphQL Integration:**

```typescript
const { data, loading, error } = usePreviewMerge(sourceBranchId, targetBranchId, worldTime);

const handleProceedToResolve = () => {
  // Open ConflictResolutionDialog
  setShowResolutionDialog(true);
};

const handleExecuteMerge = async () => {
  // No conflicts - execute directly
  await executeMergeMutation({
    variables: { input: { sourceBranchId, targetBranchId, worldTime } },
  });
};
```

#### ConflictResolutionDialog

Location: `packages/frontend/src/components/features/branches/ConflictResolutionDialog.tsx`

Interactive conflict resolution with manual editing:

**Features:**

- **Three Resolution Options per Conflict:**
  - **Use Source** - Apply source branch value
  - **Use Target** - Keep target branch value
  - **Edit Manually** - JSON editor with validation
- **Progress Tracking** - Progress bar showing X/Y conflicts resolved
- **Expandable 3-Way Diff** - View Base/Source/Target for each conflict
- **Resolution Preview** - Shows parsed JSON value after selection
- **Entity Grouping** - Collapsible cards showing "X/Y resolved" badges
- **Green Checkmarks** - Indicate fully resolved entities
- **Success/Warning Alerts** - Adapt based on resolution state
- **Disabled Execute Button** - Until all conflicts resolved
- **Real-Time JSON Validation** - Error messages for invalid custom values

**State Management:**

```typescript
const [resolutionState, setResolutionState] = useState<Map<string, ConflictResolutionState>>(
  new Map()
);

// Key format: `${entityId}:${path}` for unique conflict identification
const handleResolveConflict = (conflict: MergeConflict, value: any) => {
  const key = `${conflict.entityId}:${conflict.path}`;
  setResolutionState((prev) =>
    new Map(prev).set(key, {
      method: 'source' | 'target' | 'custom',
      value,
      isValid: true,
    })
  );
};

// Execute merge when all resolved
const handleExecute = async () => {
  const resolutions = Array.from(resolutionState.entries()).map(([key, state]) => {
    const [entityId, path] = key.split(':');
    return { entityId, path, resolvedValue: state.value };
  });

  await executeMergeMutation({
    variables: { input: { sourceBranchId, targetBranchId, worldTime, resolutions } },
  });
};
```

#### CherryPickDialog

Location: `packages/frontend/src/components/features/branches/CherryPickDialog.tsx`

Cherry-pick individual versions with conflict handling:

**Features:**

- **Version Information Display** - Shows entity type, ID, and description
- **Target Branch Selection** - Color-coded branch display
- **Two-Phase Conflict Flow:**
  1. Initial attempt → detect conflicts
  2. Manual resolution → retry with resolutions
- **Inline Conflict Resolution** - Embedded `CherryPickConflictDialog` for conflicts
- **JSON Editor with Validation** - Real-time parsing and error messages
- **Progress Tracking** - Resolved vs total conflicts
- **Success/Error State Management** - Comprehensive validation
- **Loading States** - Disabled buttons and spinner animations

**GraphQL Integration:**

```typescript
const [cherryPickVersion, { loading, error }] = useCherryPickVersion();

const handleCherryPick = async () => {
  const result = await cherryPickVersion({
    variables: { input: { versionId, targetBranchId } },
  });

  if (result.data?.cherryPickVersion.success) {
    // Success - no conflicts
    onSuccess?.();
    onClose();
  } else if (result.data?.cherryPickVersion.conflicts) {
    // Conflicts detected - show resolution dialog
    setConflicts(result.data.cherryPickVersion.conflicts);
    setShowConflictDialog(true);
  }
};
```

#### MergeHistoryView

Location: `packages/frontend/src/components/features/branches/MergeHistoryView.tsx`

Timeline visualization of merge operations:

**Features:**

- **Timeline-Style Display** - Merge operations chronologically (most recent first)
- **Visual Flow** - Source → Target branch with direction indicator
- **Color-Coded Badges:**
  - Amber badge with AlertTriangle icon for conflicts
  - Green badge with Check icon for clean merges
- **Merge Statistics:**
  - Timestamp and world time
  - User ID
  - Entities merged count
  - Conflicts resolved count
- **Optional "View Details" Button** - Via `onViewDetails` callback prop
- **Loading Skeletons** - During data fetch
- **Empty State** - "No merge history for this branch"
- **Error State** - With retry button for network failures
- **Fully Responsive** - Card-based layout using shadcn/ui components

**GraphQL Integration:**

```typescript
const { data, loading, error, refetch } = useGetMergeHistory(branchId);

return (
  <div className="space-y-4">
    {data?.getMergeHistory.map((entry) => (
      <Card key={entry.id}>
        <div className="flex items-center gap-2">
          <Badge variant={entry.conflictsResolvedCount > 0 ? "warning" : "success"}>
            {entry.conflictsResolvedCount > 0 ? (
              <>
                <AlertTriangle className="w-3 h-3 mr-1" />
                {entry.conflictsResolvedCount} conflict{entry.conflictsResolvedCount === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <Check className="w-3 h-3 mr-1" />
                Clean merge
              </>
            )}
          </Badge>
          <span className="text-blue-600">{entry.sourceBranch.name}</span>
          <ArrowRight className="w-4 h-4" />
          <span className="text-green-600">{entry.targetBranch.name}</span>
        </div>
      </Card>
    ))}
  </div>
);
```

### Merge Workflow Examples

#### Example 1: Clean Merge (No Conflicts)

```
1. User navigates to BranchHierarchyView
2. User clicks "Merge" button on a branch
3. MergePreviewDialog opens:
   - Shows source and target branches
   - Lists auto-resolved changes (green)
   - No conflicts detected
   - Button text: "Execute Merge"
4. User clicks "Execute Merge"
5. Merge executes immediately (no resolution needed)
6. Success message: "Merged 12 entities from 'feature-branch' into 'main'"
7. Branch hierarchy refetched
8. Dialog closes
```

#### Example 2: Merge with Conflicts

```
1. User initiates merge from BranchHierarchyView
2. MergePreviewDialog opens:
   - Shows source and target branches
   - Summary: "5 entities, 3 conflicts, 2 auto-resolved"
   - Lists conflicts (red tab) and auto-resolved (green tab)
   - Button text: "Proceed to Resolve"
3. User clicks "Proceed to Resolve"
4. ConflictResolutionDialog opens:
   - Shows all 3 conflicts grouped by entity
   - Progress: "0 of 3 conflicts resolved"
5. User resolves Conflict 1:
   - Clicks "Use Source" button
   - Resolution preview shows source value
   - Progress: "1 of 3 conflicts resolved"
6. User resolves Conflict 2:
   - Clicks "Edit Manually"
   - Enters custom JSON: {"gold": 1500, "silver": 3000}
   - JSON validates successfully
   - Clicks "Save"
   - Progress: "2 of 3 conflicts resolved"
7. User resolves Conflict 3:
   - Clicks "Use Target"
   - Progress: "3 of 3 conflicts resolved"
8. "Execute Merge" button becomes enabled
9. User clicks "Execute Merge"
10. Merge executes with resolutions
11. Success message: "Merged 5 entities with 3 conflicts resolved"
12. Dialog closes
```

#### Example 3: Cherry-Pick Workflow

```
1. User views version history for a Settlement
2. User clicks "Cherry-Pick" button on a specific version
3. CherryPickDialog opens:
   - Shows version information
   - Target branch: "main"
4. User clicks "Cherry-Pick"
5. No conflicts detected
6. Version applied automatically
7. Success message: "Version cherry-picked successfully"
8. Dialog closes
```

#### Example 4: Cherry-Pick with Conflicts

```
1. User initiates cherry-pick
2. CherryPickDialog opens
3. User clicks "Cherry-Pick"
4. Conflicts detected!
5. CherryPickConflictDialog opens inline:
   - Shows 2 conflicts
   - Progress: "0 of 2 conflicts resolved"
6. User resolves conflicts using source/target/custom
7. Progress: "2 of 2 conflicts resolved"
8. User clicks "Retry Cherry-Pick"
9. Cherry-pick executes with resolutions
10. Success message displayed
11. Dialog closes
```

### Testing: Merge System

**Backend Unit Tests:**

- MergeService (20 tests): common ancestor, version retrieval, conflict detection, cherry-pick
- ConflictDetector (29 tests): property conflicts, nested properties, auto-resolution, all conflict types
- SettlementMergeHandler (17 tests): Settlement-specific conflicts, associations, domain descriptions
- StructureMergeHandler (19 tests): Structure-specific conflicts, associations, domain descriptions

**Backend Integration Tests:**

- MergeResolver (27 tests): GraphQL queries/mutations, authorization, validation, error handling
- Cherry-pick API (7 tests): validation, authorization, success scenarios, conflict resolution

**Backend E2E Tests:**

- Complete merge workflow (13 scenarios):
  1. Fork → modify → preview → resolve → merge
  2. Settlement property and association conflicts
  3. Structure property conflicts
  4. Cherry-pick without conflicts
  5. Cherry-pick with conflict resolution
  6. Multi-level branch merging (grandchild → child → parent)
  7. Merge history tracking and retrieval
  8. Error handling (incomplete resolutions, invalid ancestor)
  9. Edge cases (no-op merge, concurrent non-conflicting changes, deep nesting)
  10. Performance (100+ entities with conflicts in ~1.3 seconds)

**Frontend Component Tests:**

- MergePreviewDialog (40+ tests): display, tabs, conflicts, auto-resolved, actions, errors
- ConflictResolutionDialog (40+ tests): resolution options, custom editing, progress, execution
- CherryPickDialog (25+ tests): form, operations, conflicts, errors, keyboard shortcuts
- MergeHistoryView (38 tests): loading, empty/error states, content display, badges, interactions

**Total Merge Test Coverage:** 275+ tests

### Performance & Optimization

**Two-Pass Merge Execution:**

- Pass 1: Analyze and detect conflicts (no DB writes)
- Validation: All conflicts resolved before any DB writes
- Pass 2: Create versions atomically (transaction-wrapped)
- Benefits: Prevents wasted work, ensures consistency

**Batch Processing:**

- All entity versions resolved in parallel with `Promise.all`
- Avoids N+1 query pattern
- Efficient for large merges (100+ entities)

**Payload Reuse:**

- Compressed payloads copied directly
- No unnecessary decompression/recompression
- Reduces CPU overhead

**Transaction Safety:**

- All merge operations wrapped in Prisma transactions
- Rollback on any error
- Atomic all-or-nothing behavior

**Performance Benchmark:**

- 100 entities with conflicts: ~1.3 seconds
- Clean merge (no conflicts): <500ms
- Cherry-pick single entity: <200ms

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
