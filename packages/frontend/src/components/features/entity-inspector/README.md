# Entity Inspector Component

The Entity Inspector is a comprehensive side-panel component for viewing and editing Settlement and Structure entities. It provides a tabbed interface with six specialized views for different aspects of an entity.

## Features

- 📋 **Overview Tab**: Basic entity information, computed fields, copy-to-clipboard
- 🏛️ **Details Tab**: Entity-specific attributes and typed variables
- 🔗 **Links Tab**: Related entities with clickable navigation and breadcrumb history
- ⚙️ **Conditions Tab**: Field conditions with JSONLogic expressions and evaluation traces
- ⚡ **Effects Tab**: Effects grouped by timing phase with execution history
- 📜 **Versions Tab**: Audit trail with before/after changes
- ✏️ **Edit Mode**: Inline editing for name field with keyboard shortcuts
- ♿ **Accessible**: WCAG 2.1 Level AA compliant, keyboard-navigable, screen reader-compatible

## Installation

The Entity Inspector uses the following shadcn/ui components:

```bash
# Components already installed
- Sheet (slide-out panel)
- Tabs (tabbed navigation)
- Dialog (confirmation dialogs)
- Button, Card, Label, Input, Skeleton
```

## Usage

### Basic Example

```tsx
import { EntityInspector } from '@/components/features/entity-inspector';

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'settlement' | 'structure';
    id: string;
  } | null>(null);

  return (
    <>
      <button
        onClick={() => {
          setSelectedEntity({ type: 'settlement', id: 'settlement-1' });
          setIsOpen(true);
        }}
      >
        View Settlement
      </button>

      {selectedEntity && (
        <EntityInspector
          entityType={selectedEntity.type}
          entityId={selectedEntity.id}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
```

### Integration with Map

```tsx
import { EntityInspector } from '@/components/features/entity-inspector';
import { Map } from '@/components/features/map';

function MapPage() {
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'settlement' | 'structure';
    id: string;
  } | null>(null);

  const handleEntitySelect = (type: 'settlement' | 'structure', id: string) => {
    setSelectedEntity({ type, id });
    setInspectorOpen(true);
  };

  const handleInspectorClose = () => {
    setInspectorOpen(false);
    // Delayed cleanup for smooth animation
    setTimeout(() => setSelectedEntity(null), 300);
  };

  return (
    <>
      <Map onEntitySelect={handleEntitySelect} />

      {selectedEntity && (
        <EntityInspector
          entityType={selectedEntity.type}
          entityId={selectedEntity.id}
          isOpen={inspectorOpen}
          onClose={handleInspectorClose}
        />
      )}
    </>
  );
}
```

## API Reference

### EntityInspector Props

| Prop         | Type                          | Required | Description                       |
| ------------ | ----------------------------- | -------- | --------------------------------- |
| `entityType` | `'settlement' \| 'structure'` | ✅       | Type of entity to inspect         |
| `entityId`   | `string`                      | ✅       | ID of the entity                  |
| `isOpen`     | `boolean`                     | ✅       | Whether the inspector is open     |
| `onClose`    | `() => void`                  | ✅       | Callback when inspector is closed |

### Tabs

#### Overview Tab

- **Purpose**: Display basic entity metadata and computed fields
- **Features**:
  - ID, name, creation/update timestamps
  - Computed fields with JSON formatting
  - Copy-to-clipboard functionality
  - Inline editing for name field (edit mode)

#### Details Tab

- **Purpose**: Show entity-specific attributes and typed variables
- **Settlement**: Kingdom ID, Campaign ID, Level, Owner ID, Is Archived, Typed Variables
- **Structure**: Type, Settlement ID, Level, Position (X, Y), Orientation, Typed Variables
- **Features**:
  - Copy-to-clipboard for all fields
  - Snake_case to Title Case conversion
  - Type-based formatting (number, boolean, string, objects)

#### Links Tab

- **Purpose**: Navigate between related entities
- **Features**:
  - Clickable links to related entities
  - Navigation stack with breadcrumb history
  - Back button to previous entity
  - Settlement → Kingdom, Location, Campaign, Structures
  - Structure → Settlement

#### Conditions Tab

- **Purpose**: View field conditions and their evaluation logic
- **Features**:
  - Active/Inactive status badges
  - Instance/Type-level indicators
  - Priority sorting (highest first)
  - JSONLogic expression display
  - "Explain" button with evaluation trace

#### Effects Tab

- **Purpose**: View effects and their execution history
- **Features**:
  - Grouped by timing phase (PRE/ON_RESOLVE/POST)
  - Priority sorting within phases
  - JSON Patch operations display
  - Execution history modal
  - Status badges (SUCCESS/FAILURE/ERROR)

#### Versions Tab

- **Purpose**: View audit trail and change history
- **Features**:
  - Chronological timeline (newest first)
  - Operation color coding (CREATE/UPDATE/DELETE/ARCHIVE/RESTORE)
  - Before/after change display
  - "LATEST" badge on most recent entry
  - User attribution
  - Relative timestamps

## Edit Mode

### Keyboard Shortcuts

- **Ctrl+S** (Windows/Linux) / **Cmd+S** (Mac): Save changes
- **Esc**: Cancel editing

### Editable Fields

Currently, only the **name** field is editable in the Overview tab. Future enhancements will add:

- Description field (when added to backend schema)
- Typed variables in Details tab
- Condition priority and active status
- Effect priority and active status

### Edit Workflow

1. Click **Edit** button in inspector header
2. Modify the name field
3. Save via **Save** button or **Ctrl+S**
4. Cancel via **Cancel** button or **Esc**
5. Unsaved changes prompt confirmation dialog

### Validation

- **Name**: Required (cannot be empty)
- Future: Type-specific validation for typed variables

## Navigation

### Navigation Stack

The inspector maintains a navigation stack when you click links:

```
Initial: Settlement A
Click "Structures" → Structure B
  Stack: [Settlement A]
Click "Settlement" → Settlement A
  Stack: []
```

### Breadcrumb Trail

Breadcrumb shows the navigation history with entity names:

```
Settlement A › Structure B › Settlement C
```

### Back Button

Click the back button or navigate backward to return to the previous entity in the stack.

### Limitations

- Only Settlement and Structure navigation supported
- Kingdom, Location, Campaign links show TODO warning (future enhancement)

## Accessibility

The Entity Inspector meets **WCAG 2.1 Level AA** compliance standards.

### Keyboard Navigation

- All interactive elements keyboard-accessible
- Tab order follows visual layout
- Enter/Space activate buttons and links
- Ctrl+S to save, Esc to cancel

### Screen Reader Support

- Proper ARIA labels and roles
- Dialog components announce titles and descriptions
- Loading/error states announced
- Button labels descriptive

### Visual Design

- Color contrast meets AA standards (4.5:1)
- Status indicated by color + text (not color alone)
- Minimum text size 12px (labels), 14px (body)
- Touch targets minimum 44x44px

See [entity-inspector-accessibility.md](../../../../docs/features/entity-inspector-accessibility.md) for full accessibility documentation.

## Responsive Design

### Breakpoints

- **Mobile** (`< 640px`): 3-column tab grid, full-width sheet
- **Tablet** (`640px - 1024px`): 6-column tab grid, constrained sheet (max-w-xl)
- **Desktop** (`> 1024px`): 6-column tab grid, constrained sheet

### Sheet Width

- Mobile: Full-width (`w-full`)
- Desktop: Max-width 36rem (`sm:max-w-xl`)

### Tab Layout

```tsx
<TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
```

Mobile: 2 rows of 3 tabs
Desktop: 1 row of 6 tabs

## Performance

### Data Fetching

- Settlement and Structure queries skip based on `entityType` (no unnecessary fetches)
- Tabs use cache-first fetch policy (Apollo Client)
- Lazy loading: Data fetched only when inspector opens

### Loading States

- Skeleton screens for initial load
- Loading text for tab data
- Disabled buttons during save operations

### Optimizations

- React.memo not required (small component tree)
- Minimal re-renders via useCallback for event handlers
- No heavy computations (all data pre-formatted by backend)

## Testing

### Unit Tests

```bash
# Run all inspector tests
pnpm --filter @campaign/frontend test entity-inspector

# Run specific test file
pnpm --filter @campaign/frontend test EntityInspector.test.tsx
```

### Test Coverage

- **EntityInspector**: 12 tests (rendering, loading, errors, navigation, tabs)
- **OverviewTab**: 20 tests (display, copy, edit mode, validation)
- **ConditionsTab**: 22 tests (loading, error, display, explanation)
- **EffectsTab**: 23 tests (loading, error, display, execution history)
- **LinksTab**: 24 tests (loading, error, display, navigation, keyboard)
- **VersionsTab**: 24 tests (loading, error, display, operations, changes)
- **SettlementPanel**: 24 tests (attributes, variables, copy, formatting)
- **StructurePanel**: 25 tests (attributes, variables, copy, formatting)

**Total**: 174 tests, 100% passing

### Mock Data

Tests use MSW (Mock Service Worker) for GraphQL mocking:

```typescript
import { renderWithApollo } from '@/__tests__/utils';

test('displays settlement data', async () => {
  renderWithApollo(
    <EntityInspector
      entityType="settlement"
      entityId="settlement-1"
      isOpen={true}
      onClose={jest.fn()}
    />
  );

  await screen.findByText('Ironhold');
});
```

## Known Limitations

1. **Edit Mode**: Only name field editable (description and typed variables future enhancement)
2. **Navigation**: Kingdom/Location/Campaign navigation not implemented
3. **Optimistic Updates**: Not implemented (mutations wait for server response)
4. **Condition Evaluation**: Manual "Explain" click required (no auto-evaluation)
5. **Effect Execution**: View-only (no manual trigger)

## Future Enhancements

### Short-Term (Next Ticket)

- [ ] Extend edit mode to typed variables in Details tab
- [ ] Add description field editing (requires backend schema update)
- [ ] Implement optimistic updates for mutations
- [ ] Add loading skeletons matching tab structure

### Long-Term

- [ ] Kingdom/Location/Campaign navigation support
- [ ] Condition active status toggle
- [ ] Effect priority editing
- [ ] Bulk edit mode for multiple entities
- [ ] Export audit history as CSV
- [ ] Condition syntax highlighting (JSONLogic)
- [ ] Effect patch preview before execution

## Troubleshooting

### Inspector Not Opening

**Problem**: `isOpen={true}` but Sheet doesn't appear

**Solution**: Ensure `selectedEntity` is not null:

```tsx
{selectedEntity && (
  <EntityInspector ... />
)}
```

### Navigation Not Working

**Problem**: Clicking links doesn't navigate

**Solution**: Provide `onNavigate` callback to LinksTab:

```tsx
<LinksTab
  entityType={entityType}
  entityId={entityId}
  onNavigate={handleNavigate} // Required for navigation
/>
```

### Edit Mode Not Saving

**Problem**: Clicking Save doesn't persist changes

**Solution**: Check mutation hook errors:

```tsx
const { updateSettlement, loading, error } = useUpdateSettlement();

// Log errors
useEffect(() => {
  if (error) console.error('Mutation error:', error);
}, [error]);
```

### Keyboard Shortcuts Not Working

**Problem**: Ctrl+S doesn't save

**Solution**: Ensure inspector is open AND in edit mode:

```tsx
// Shortcuts only work when:
isOpen={true} && isEditing={true}
```

## Architecture

### Component Structure

```
EntityInspector (Root)
├── Sheet (shadcn/ui)
│   ├── SheetHeader
│   │   ├── Breadcrumb Navigation
│   │   ├── Back Button
│   │   └── Edit Controls (Edit/Save/Cancel)
│   └── SheetContent
│       └── Tabs
│           ├── OverviewTab
│           ├── DetailsTab (Settlement | StructurePanel)
│           ├── LinksTab
│           ├── ConditionsTab
│           ├── EffectsTab
│           └── VersionsTab
└── Dialog (Unsaved Changes Confirmation)
```

### State Management

- **Local State**: Navigation stack, edit mode, dirty state
- **GraphQL State**: Apollo Client cache (settlement/structure data)
- **Form State**: `useEditMode` hook (edit data, validation, save)

### Data Flow

```
Parent Component
  ↓ (entityType, entityId, isOpen)
EntityInspector
  ↓ (currentEntityType, currentEntityId from navigation)
useSettlementDetails / useStructureDetails
  ↓ (entity data from GraphQL)
Tabs (display entity data)
```

### Edit Mode Flow

```
User clicks "Edit"
  ↓
isEditing = true
  ↓
OverviewTab renders EditableField
  ↓
User modifies name
  ↓
isDirty = true (reported to EntityInspector)
  ↓
User clicks "Save" (or Ctrl+S)
  ↓
tabSaveRef.current() called
  ↓
useEditMode.save() → mutation
  ↓
onSaveComplete() → isEditing = false, isDirty = false
```

## Contributing

### Adding a New Tab

1. Create component in `entity-inspector/`:

```tsx
// NewTab.tsx
export function NewTab({ entityType, entityId }: NewTabProps) {
  // Fetch data, handle loading/error/empty states
  return <Card>...</Card>;
}
```

2. Add to EntityInspector:

```tsx
<TabsTrigger value="newtab">New Tab</TabsTrigger>

<TabsContent value="newtab">
  <NewTab entityType={currentEntityType} entityId={currentEntityId} />
</TabsContent>
```

3. Update tab grid class:

```tsx
<TabsList className="grid w-full grid-cols-3 sm:grid-cols-7">
```

4. Write tests:

```tsx
// NewTab.test.tsx
describe('NewTab', () => {
  it('should display loading state', () => { ... });
  it('should display error state', () => { ... });
  it('should display data', () => { ... });
});
```

### Adding Edit Support to a Tab

1. Accept edit mode props:

```tsx
interface MyTabProps {
  isEditing?: boolean;
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  onDirtyChange?: (isDirty: boolean) => void;
}
```

2. Use `useEditMode` hook:

```tsx
const { data, updateField, save, isDirty } = useEditMode({
  initialData: { field: entity.field },
  onSave: async (data) => { await mutation(data); },
  validate: (field, value) => { ... }
});
```

3. Render `EditableField`:

```tsx
<EditableField
  label="Field"
  value={data.field}
  isEditing={isEditing}
  onChange={(value) => updateField('field', value)}
  type="text"
/>
```

4. Expose save function:

```tsx
useEffect(() => {
  if (saveRef) saveRef.current = save;
}, [saveRef, save]);
```

## License

Part of the Campaign Management Tool project.
See root LICENSE file for details.

## Related Documentation

- [Entity Inspector Accessibility](../../../../docs/features/entity-inspector-accessibility.md)
- [Condition System](../../../../docs/features/condition-system.md)
- [Effect System](../../../../docs/features/effect-system.md)
- [World Time System](../../../../docs/features/world-time-system.md)
- [Dependency Graph System](../../../../docs/features/dependency-graph-system.md)

## Support

For issues, questions, or contributions:

1. Check existing tests for usage examples
2. Review accessibility documentation for compliance
3. Consult CLAUDE.md for project conventions
4. Open an issue on GitHub (if applicable)
