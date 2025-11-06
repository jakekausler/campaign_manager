# Audit Log Filters Research - Frontend Patterns

## Overview

Research findings for implementing audit log filters in the frontend, including date range pickers, multi-select filters, URL persistence, pagination, and sorting patterns.

## 1. URL Query Parameter Persistence Pattern

### Location

- **TimelinePage**: `/storage/programs/campaign_manager/packages/frontend/src/pages/TimelinePage.tsx`
- **Utility Functions**: `/storage/programs/campaign_manager/packages/frontend/src/utils/timeline-filters.ts`

### Implementation Details

**URL Serialization (to URL)**:

```typescript
export function serializeFiltersToURL(filters: TimelineFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Only add params if they differ from defaults (keeps URL clean)
  if (typesChanged) {
    params.set('types', filters.eventTypes.join(','));
  }
  if (statusChanged) {
    params.set('status', filters.statusFilters.join(','));
  }
  if (groupChanged) {
    params.set('group', filters.groupBy);
  }

  return params;
}
```

**URL Parsing (from URL)**:

```typescript
export function parseFiltersFromURL(searchParams: URLSearchParams): TimelineFilters {
  const typesParam = searchParams.get('types');
  const statusParam = searchParams.get('status');
  const groupParam = searchParams.get('group');

  // Parse and validate each parameter
  const eventTypes = typesParam
    ? (typesParam.split(',').filter((t) => VALID_TYPES.includes(t)) as EventType[])
    : DEFAULT_FILTERS.eventTypes;

  return { eventTypes, statusFilters, groupBy };
}
```

**Integration in Component**:

```typescript
// TimelinePage.tsx
const [searchParams, setSearchParams] = useSearchParams();

// Parse filters from URL or use defaults
const [filters, setFilters] = useState<FilterConfig>(() => parseFiltersFromURL(searchParams));

// Sync filters to URL when they change
useEffect(() => {
  const params = serializeFiltersToURL(filters);
  setSearchParams(params, { replace: true });
}, [filters, setSearchParams]);
```

### Key Patterns

1. Use React Router's `useSearchParams()` hook
2. Use URLSearchParams for query parameter manipulation
3. Only include non-default values in URL (keeps URL clean)
4. Validate parsed values against allowed options
5. Use `replace: true` in `setSearchParams()` to replace history entry
6. Parse filters in useState initializer function for clean initialization

---

## 2. Multi-Select Filter Pattern

### Location

- **TimelineFilters Component**: `/storage/programs/campaign_manager/packages/frontend/src/components/features/timeline/TimelineFilters.tsx`

### UI Library

- **Radix UI Select** (`@radix-ui/react-select`)
- Standard HTML checkboxes for multi-select within filter groups
- Lucide React icons for visual indicators

### Implementation Example

```typescript
// TimelineFilters.tsx
const handleEventTypeToggle = (eventType: EventType) => {
  const newEventTypes = filters.eventTypes.includes(eventType)
    ? filters.eventTypes.filter((t) => t !== eventType)
    : [...filters.eventTypes, eventType];

  // Ensure at least one event type is selected
  if (newEventTypes.length === 0) {
    return;
  }

  onChange({
    ...filters,
    eventTypes: newEventTypes,
  });
};

// Render checkboxes
{Object.entries(EVENT_TYPE_LABELS).map(([type, label]) => (
  <label key={type} className="flex items-center space-x-2 cursor-pointer">
    <input
      type="checkbox"
      checked={filters.eventTypes.includes(type)}
      onChange={() => handleEventTypeToggle(type)}
    />
    <span>{label}</span>
  </label>
))}
```

### UI Components Available

- **Input** (`@/components/ui/input`): Text input with basic styling
- **Select** (`@radix-ui/react-select`): Dropdown with Radix UI primitives
- **Checkbox** (`@radix-ui/react-checkbox`): Accessible checkbox component
- **Button** (`@/components/ui/button`): Standard button component

---

## 3. Date Handling and Date-FNS Integration

### Installed Package

- **date-fns** (v4.1.0): Date manipulation and formatting utility library

### Current Usage

- **VersionList.tsx**: Uses `format()` and `formatDistanceToNow()`
- **ComparisonDialog.tsx**: Uses `format()` and `formatDistanceToNow()`

### Recommended Approach for Date Range Picker

Since no specialized date picker library is installed (like react-datepicker or react-dates), the recommendation is:

1. **Use native HTML5 date input** for simple date range selection:

   ```tsx
   <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
   ```

2. **Use date-fns for formatting and manipulation**:

   ```typescript
   import { format, parseISO } from 'date-fns';

   const formatted = format(new Date(dateString), 'MMM dd, yyyy');
   const parsed = parseISO(dateInputValue);
   ```

3. **Alternative: Consider adding popover + calendar**:
   - Could use Radix UI popover with custom calendar
   - No external date picker lib currently used

### Current Time Handling Example

```typescript
// World time management
const { currentTime } = useCurrentWorldTime(campaignId || undefined);

// Date formatting
const formatted = format(new Date(timestamp), 'MMM dd, yyyy HH:mm');
```

---

## 4. Apollo Client Pagination Pattern

### Apollo Client Setup

- **Version**: @apollo/client v4.0.7
- **Hook Used**: `useQuery()` from `@apollo/client/react`

### Current Audit Query Structure (audit.ts)

```typescript
const GET_ENTITY_AUDIT_HISTORY = gql`
  query GetEntityAuditHistory($entityType: String!, $entityId: ID!, $limit: Int) {
    entityAuditHistory(entityType: $entityType, entityId: $entityId, limit: $limit) {
      id
      entityType
      entityId
      operation
      userId
      changes
      metadata
      timestamp
      # Enhanced fields
      previousState
      newState
      diff
      reason
    }
  }
`;
```

### Current Hook Implementation

```typescript
export function useEntityAuditHistory(entityType: string, entityId: string, limit: number = 50) {
  const { data, loading, error, refetch } = useQuery<
    EntityAuditHistoryData,
    EntityAuditHistoryVariables
  >(GET_ENTITY_AUDIT_HISTORY, {
    variables: { entityType, entityId, limit },
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
    skip: !entityType || !entityId,
  });

  return {
    audits: data?.entityAuditHistory || [],
    loading,
    error,
    refetch,
  };
}
```

### Apollo Client Fetch Policies

- **cache-first** (default for entity audit): Use cache, fetch if missing
- **cache-and-network**: Always fetch, update cache (used for user audit history)
- **network-only**: Always fetch from network

### Recommended Pagination Enhancement for Audit Logs

1. **Add offset/limit pagination**:

   ```typescript
   const { data, loading, error, fetchMore } = useQuery(QUERY, {
     variables: { offset: 0, limit: 20 },
     notifyOnNetworkStatusChange: true,
   });

   const loadMore = () => {
     fetchMore({
       variables: {
         offset: audits.length,
       },
       updateQuery: (prev, { fetchMoreResult }) => {
         return {
           entityAuditHistory: [...prev.entityAuditHistory, ...fetchMoreResult.entityAuditHistory],
         };
       },
     });
   };
   ```

2. **Or use cursor-based pagination** (preferred for large datasets)

---

## 5. Virtual Scrolling / Infinite Scroll Pattern

### Installed Package

- **@tanstack/react-virtual** (v3.13.12): Virtual scrolling library

### Implementation Location

- **StructureListView.tsx**: `/storage/programs/campaign_manager/packages/frontend/src/components/features/entity-inspector/StructureListView.tsx`

### Virtual Scrolling Example

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export function StructureListView({ settlementId, onStructureSelect }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Virtual scrolling setup
  const enableVirtualScrolling = filteredAndSortedStructures.length >= 50;

  const rowVirtualizer = useVirtualizer({
    count: filteredAndSortedStructures.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 72, []), // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
    enabled: enableVirtualScrolling, // Only enable for 50+ items
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      style={{
        overflow: 'auto',
        height: 'calc(100vh - 200px)',
      }}
    >
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {virtualItems.map((virtualItem) => (
          <div key={virtualItem.key} style={{ transform: `translateY(${virtualItem.start}px)` }}>
            {/* Render item */}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Key Pattern

- Only enable virtual scrolling for lists with 50+ items
- Estimate row height for better scrolling performance
- Use overscan property (5 extra items) to prevent blank spaces
- Virtual scrolling works with any sorted/filtered list

---

## 6. Sortable Table Column Pattern

### Location

- **StructureListView.tsx**: Implements sorting with column headers

### Sort Implementation

```typescript
// State management
const [sortBy, setSortBy] = useState<SortBy>('name');
const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

// Sort toggle handler
const handleSortChange = useCallback(
  (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  },
  [sortBy, sortOrder]
);

// Sort logic in useMemo
const filteredAndSortedStructures = useMemo(() => {
  let result = [...structures];

  // Apply filtering...

  // Apply sorting
  result.sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'type':
        compareValue = (a.type ?? '').localeCompare(b.type ?? '');
        break;
      case 'level':
        compareValue = (a.level ?? 0) - (b.level ?? 0);
        break;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  return result;
}, [structures, debouncedSearchQuery, filterType, sortBy, sortOrder]);
```

### Render Sort Indicators

```tsx
<button onClick={() => handleSortChange('name')}>
  Name
  {sortBy === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
</button>
```

---

## 7. Existing Audit Components

### AuditLogTable Component

- **Location**: `/storage/programs/campaign_manager/packages/frontend/src/components/features/audit/AuditLogTable.tsx`
- **Status**: Basic table component exists (no filters yet)
- **Current Features**:
  - Displays audit entries in card-based list
  - Loading skeleton state
  - Error state with message
  - Empty state with icon
  - Shows operation type and timestamp

### Audit Hook

- **Location**: `/storage/programs/campaign_manager/packages/frontend/src/services/api/hooks/audit.ts`
- **Available Functions**:
  - `useEntityAuditHistory(entityType, entityId, limit)` - For entity-specific audit
  - `useUserAuditHistory(limit)` - For user's audit history

---

## 8. Recommended Architecture for Audit Log Filters

### Component Structure

```
AuditLogPage
├── AuditLogFilters (new)
│   ├── DateRange picker inputs
│   ├── Operation type multi-select
│   ├── Entity type multi-select
│   ├── User/Creator filter
│   └── Search box
├── AuditLogTable (existing, enhance)
│   ├── Sortable columns (operation, timestamp, user, entity)
│   └── Virtual scrolling for large lists
└── Pagination controls (load more / infinite scroll)
```

### State Management Recommendations

1. **Use URL params** for filter persistence (like TimelinePage)
2. **Use useState** for local filter state
3. **Use useCallback** for filter handlers
4. **Use useMemo** for filtered/sorted/paginated data

### Filter Defaults

```typescript
interface AuditLogFilters {
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  operations: string[];
  entityTypes: string[];
  userId?: string;
  searchQuery: string;
  sortBy: 'timestamp' | 'operation' | 'entityType' | 'user';
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

const DEFAULT_AUDIT_FILTERS: AuditLogFilters = {
  operations: [], // empty = all
  entityTypes: [], // empty = all
  sortBy: 'timestamp',
  sortOrder: 'desc',
  limit: 50,
  offset: 0,
};
```

---

## 9. Key Dependencies Summary

| Package                 | Version  | Usage                             |
| ----------------------- | -------- | --------------------------------- |
| @apollo/client          | ^4.0.7   | GraphQL queries and pagination    |
| react-router-dom        | ^7.9.4   | URL params (useSearchParams)      |
| @radix-ui/react-select  | ^2.2.6   | Multi-select dropdowns            |
| @tanstack/react-virtual | ^3.13.12 | Virtual scrolling for large lists |
| date-fns                | ^4.1.0   | Date formatting and parsing       |
| lucide-react            | ^0.546.0 | Icons for UI                      |
| clsx                    | ^2.1.1   | Conditional className merging     |

---

## 10. File Paths Reference

| Component/Utility                   | Path                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| TimelineFilters component           | packages/frontend/src/components/features/timeline/TimelineFilters.tsx           |
| Timeline filter utilities           | packages/frontend/src/utils/timeline-filters.ts                                  |
| TimelinePage (example)              | packages/frontend/src/pages/TimelinePage.tsx                                     |
| AuditLogTable component             | packages/frontend/src/components/features/audit/AuditLogTable.tsx                |
| Audit hooks                         | packages/frontend/src/services/api/hooks/audit.ts                                |
| StructureListView (sorting/virtual) | packages/frontend/src/components/features/entity-inspector/StructureListView.tsx |
| UI components                       | packages/frontend/src/components/ui/                                             |

---

## Implementation Recommendations for Audit Log Filters

### Phase 1: Basic Filtering

1. Add date range inputs using native HTML date inputs
2. Add operation type multi-select with checkboxes
3. Add search box for entity ID/type
4. Persist filters to URL like TimelinePage does

### Phase 2: Sorting & Pagination

1. Add sortable column headers
2. Implement "load more" button with Apollo fetchMore
3. Add virtual scrolling when list exceeds 50 items

### Phase 3: Advanced Filtering

1. User/creator filter with dropdown
2. Multiple entity type selection
3. Date range validation (start < end)
4. Filter presets/saved filters

### Code Patterns to Follow

1. Use TimelinePage as reference for URL persistence
2. Use StructureListView as reference for sorting/virtual scrolling
3. Use TimelineFilters as reference for multi-select UI
4. Reuse @radix-ui and existing UI component patterns
