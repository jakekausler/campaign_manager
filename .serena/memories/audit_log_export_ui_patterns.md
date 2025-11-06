# Audit Log Export - UI Components Research

## UI Library & Components

### Framework Stack

- **Dialog Component**: Radix UI (`@radix-ui/react-alert-dialog` and `@radix-ui/react-dialog`)
- **Toast/Notifications**: Sonner (`sonner` v2.0.7)
- **Styling**: Tailwind CSS with custom wrapper components in `packages/frontend/src/components/ui/`

## Confirmation Dialogs

### AlertDialog (Recommended for confirmations)

**File**: `/storage/programs/campaign_manager/packages/frontend/src/components/ui/alert-dialog.tsx`

Built on Radix UI's AlertDialog with button styling. Components:

- `AlertDialog` - Root component
- `AlertDialogContent` - Modal content wrapper
- `AlertDialogHeader` - Title/description container
- `AlertDialogTitle` - Large bold title
- `AlertDialogDescription` - Description text (supports JSX with `asChild`)
- `AlertDialogFooter` - Button container
- `AlertDialogAction` - Primary action button (styled as button)
- `AlertDialogCancel` - Cancel button (outline style)

### Example Implementation

**File**: `/storage/programs/campaign_manager/packages/frontend/src/components/features/entity-inspector/LevelChangeConfirmationDialog.tsx`

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function LevelChangeConfirmationDialog({
  open,
  onClose,
  onConfirm,
  entityType,
  entityName,
  currentLevel,
  newLevel,
  loading = false,
}: LevelChangeConfirmationDialogProps) {
  const isIncreasing = newLevel > currentLevel;
  const levelChange = isIncreasing ? 'increase' : 'decrease';

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Level Change</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                You are about to {levelChange} the level of <strong>{entityName}</strong> from{' '}
                {currentLevel} to {newLevel}.
              </p>
              <p className="pt-2 text-sm text-muted-foreground">
                <strong className="text-amber-600">⚠️ Important:</strong> Details here
              </p>
              <ul className="list-inside list-disc space-y-1 pl-4 text-sm">
                <li>Item 1</li>
                <li>Item 2</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading} onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? 'Processing...' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

### Key Patterns

1. **Open state management**: `open` prop with `onOpenChange` callback
2. **Loading state**: Disables both buttons during processing, shows loading text
3. **Rich descriptions**: Use `asChild` on Description to support JSX content
4. **Warnings**: Use amber-600 colored `<strong>` tags for warnings
5. **Click handling**: Prevent default on action button, then call handler

## Toast Notifications

### Library: Sonner

**File**: `/storage/programs/campaign_manager/packages/frontend/src/components/ui/toaster.tsx`

Pre-configured Toaster component with theme customization:

```tsx
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-white ...',
          description: 'group-[.toast]:text-slate-500',
          error: 'group toast-error group-[.toaster]:bg-red-50 ...',
          success: 'group toast-success group-[.toaster]:bg-green-50 ...',
          warning: 'group toast-warning group-[.toaster]:bg-yellow-50 ...',
          info: 'group toast-info group-[.toaster]:bg-blue-50 ...',
        },
      }}
      richColors
    />
  );
}
```

### Toast Usage Pattern

**Import**: `import { toast } from 'sonner';`

Common methods:

```typescript
// Success notification
toast.success('Action completed', {
  description: 'Optional description text',
});

// Error notification
toast.error('Action failed', {
  description: 'Error details here',
});

// Info notification
toast.info('Information message');

// Warning notification
toast.warning('Warning message');

// Promise-based (for async operations)
toast.promise(promise, {
  loading: 'Loading...',
  success: 'Done!',
  error: 'Error',
});
```

### Real Example from Codebase

**File**: `/storage/programs/campaign_manager/packages/frontend/src/components/features/entity-inspector/LevelControl.tsx`

```typescript
import { toast } from 'sonner';

const confirmLevelChange = async () => {
  try {
    // ... perform mutation
    toast.success('Level updated', {
      description: `Updated ${entityName} to level ${pendingLevel}`,
    });
  } catch (error) {
    toast.error('Failed to update level', {
      description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
```

### Setup Requirement

The `<Toaster />` component must be added to the root App component:

**File**: `/storage/programs/campaign_manager/packages/frontend/src/App.tsx`

```tsx
import { Toaster } from '@/components/ui/toaster';

function AppContent() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
```

## Implementation Checklist for Audit Log Export

### Confirmation Dialog

1. Create `ExportAuditLogsDialog.tsx` using AlertDialog pattern
2. Props: `open`, `onClose`, `onConfirm`, `loading`, `exportFormat`, `entityCount`
3. Warning about export scope/data size
4. Loading state for buttons

### Toast Notifications

1. Import `import { toast } from 'sonner'`
2. On successful export: `toast.success('Audit logs exported', { description: '...' })`
3. On error: `toast.error('Export failed', { description: error.message })`
4. Optional: Use `toast.promise()` for streaming export progress

### Files to Reference

- Dialog: `/storage/programs/campaign_manager/packages/frontend/src/components/features/entity-inspector/LevelChangeConfirmationDialog.tsx`
- Toast: `/storage/programs/campaign_manager/packages/frontend/src/components/features/entity-inspector/LevelControl.tsx`
- Other confirmations:
  - `/storage/programs/campaign_manager/packages/frontend/src/components/features/branches/DeleteBranchDialog.tsx`
  - `/storage/programs/campaign_manager/packages/frontend/src/components/features/versions/RestoreConfirmationDialog.tsx`
