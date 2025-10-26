import { ChevronLeft, Edit2, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAllEffectsForEntity,
  useEncounterDetails,
  useEventDetails,
  useSettlementDetails,
  useStructureDetails,
} from '@/services/api/hooks';
import { useCompleteEvent, useResolveEncounter } from '@/services/api/mutations';
import { validateResolution } from '@/utils/resolution-validation';

import { ConditionsTab } from './ConditionsTab';
import { EffectsTab } from './EffectsTab';
import { EncounterPanel } from './EncounterPanel';
import { EventPanel } from './EventPanel';
import { LinksTab, type EntityLink } from './LinksTab';
import { OverviewTab } from './OverviewTab';
import { ResolutionButton } from './ResolutionButton';
import { ResolutionDialog } from './ResolutionDialog';
import { SettlementPanel } from './SettlementPanel';
import { StructurePanel } from './StructurePanel';
import { VersionsTab } from './VersionsTab';

export type EntityType = 'settlement' | 'structure' | 'event' | 'encounter';

export interface EntityInspectorProps {
  /** Type of entity being inspected */
  entityType: EntityType;
  /** ID of the entity to inspect */
  entityId: string;
  /** Whether the inspector is open */
  isOpen: boolean;
  /** Callback when the inspector is closed */
  onClose: () => void;
}

/**
 * Navigation history item
 */
interface NavigationHistoryItem {
  entityType: EntityType;
  entityId: string;
  entityName: string;
}

/**
 * EntityInspector component displays detailed information about an entity
 * in a side panel (Sheet) with tabbed navigation for different aspects
 * of the entity (Overview, Links, Conditions, Effects, Versions).
 *
 * Features:
 * - Navigation stack for browsing related entities
 * - Breadcrumb navigation showing entity history
 * - Back button to return to previous entity
 */
export function EntityInspector({ entityType, entityId, isOpen, onClose }: EntityInspectorProps) {
  // Navigation state: stack of visited entities
  const [navigationStack, setNavigationStack] = useState<NavigationHistoryItem[]>([]);

  // Current entity being viewed (defaults to props, but can be overridden by navigation)
  const [currentEntityType, setCurrentEntityType] = useState<EntityType>(entityType);
  const [currentEntityId, setCurrentEntityId] = useState<string>(entityId);

  // Edit mode state (managed at inspector level to show controls in header)
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Resolution dialog state
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);

  // Ref to access tab's save function
  const tabSaveRef = useRef<(() => Promise<boolean>) | null>(null);

  // Reset navigation and edit state when inspector opens with new entity
  useEffect(() => {
    if (isOpen) {
      setCurrentEntityType(entityType);
      setCurrentEntityId(entityId);
      setNavigationStack([]);
      setIsEditing(false);
      setHasUnsavedChanges(false);
    }
  }, [isOpen, entityType, entityId]);

  /**
   * Cancel edit mode
   */
  const handleCancelEditing = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return;
    }
    setIsEditing(false);
  }, [hasUnsavedChanges]);

  /**
   * Save changes (triggered by save button, delegated to active tab)
   */
  const handleSave = useCallback(async () => {
    // Call the tab's save function via ref
    if (tabSaveRef.current) {
      const success = await tabSaveRef.current();
      if (success) {
        setHasUnsavedChanges(false);
        setIsEditing(false);
      }
    }
  }, []);

  // Keyboard shortcuts (Ctrl+S to save, Esc to cancel)
  useEffect(() => {
    if (!isOpen || !isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Esc to cancel
      else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEditing();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditing, handleSave, handleCancelEditing]);

  // Conditionally fetch entity data based on type
  const settlementQuery = useSettlementDetails(currentEntityId, {
    skip: currentEntityType !== 'settlement',
  });
  const structureQuery = useStructureDetails(currentEntityId, {
    skip: currentEntityType !== 'structure',
  });
  const eventQuery = useEventDetails(currentEntityId, {
    skip: currentEntityType !== 'event',
  });
  const encounterQuery = useEncounterDetails(currentEntityId, {
    skip: currentEntityType !== 'encounter',
  });

  // Helper function to get display name for entity type
  const getEntityTypeName = (type: EntityType): string => {
    switch (type) {
      case 'settlement':
        return 'Settlement';
      case 'structure':
        return 'Structure';
      case 'event':
        return 'Event';
      case 'encounter':
        return 'Encounter';
    }
  };

  // Fetch effects for resolution dialog (only for Event/Encounter)
  const { allEffects } = useAllEffectsForEntity(
    getEntityTypeName(currentEntityType),
    currentEntityId
  );

  // Resolution mutation hooks
  const { completeEvent, loading: completingEvent } = useCompleteEvent();
  const { resolveEncounter, loading: resolvingEncounter } = useResolveEncounter();

  // Combined loading state for resolution
  const isResolving = completingEvent || resolvingEncounter;

  // Helper function to get the appropriate query based on entity type
  const getQuery = () => {
    switch (currentEntityType) {
      case 'settlement':
        return settlementQuery;
      case 'structure':
        return structureQuery;
      case 'event':
        return eventQuery;
      case 'encounter':
        return encounterQuery;
    }
  };

  // Helper function to get the entity from the appropriate query
  const getEntity = () => {
    switch (currentEntityType) {
      case 'settlement':
        return settlementQuery.settlement;
      case 'structure':
        return structureQuery.structure;
      case 'event':
        return eventQuery.event;
      case 'encounter':
        return encounterQuery.encounter;
    }
  };

  const query = getQuery();
  const entity = getEntity();

  /**
   * Compute validation result for resolution
   * Only validates for Event/Encounter entities
   */
  const validationResult = useMemo(() => {
    if (!entity) {
      return { isValid: true, errors: [], warnings: [] };
    }

    if (currentEntityType === 'event' || currentEntityType === 'encounter') {
      // Type assertion is safe here because we've checked currentEntityType
      return validateResolution(
        entity as Parameters<typeof validateResolution>[0],
        currentEntityType
      );
    }

    return { isValid: true, errors: [], warnings: [] };
  }, [entity, currentEntityType]);

  /**
   * Handle resolution confirmation
   * Executes appropriate mutation based on entity type and handles success/error
   */
  const handleResolutionConfirm = useCallback(async () => {
    if (!entity) return;

    try {
      let result;
      if (currentEntityType === 'event') {
        result = await completeEvent(currentEntityId);
        if (result) {
          toast.success('Event completed successfully', {
            description: `Effects executed: ${result.pre.succeeded + result.onResolve.succeeded + result.post.succeeded}`,
          });
          // Close inspector after successful resolution
          setShowResolutionDialog(false);
          onClose();
        }
      } else if (currentEntityType === 'encounter') {
        result = await resolveEncounter(currentEntityId);
        if (result) {
          toast.success('Encounter resolved successfully', {
            description: `Effects executed: ${result.pre.succeeded + result.onResolve.succeeded + result.post.succeeded}`,
          });
          // Close inspector after successful resolution
          setShowResolutionDialog(false);
          onClose();
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Resolution failed', {
        description: errorMessage,
      });
      // Keep dialog open on error to allow retry
    }
  }, [entity, currentEntityType, currentEntityId, completeEvent, resolveEncounter, onClose]);

  /**
   * Navigate to a related entity
   */
  const handleNavigate = useCallback(
    (link: EntityLink) => {
      // Only navigate to settlement, structure, event, or encounter (skip kingdom, location, campaign for now)
      if (
        link.type !== 'settlement' &&
        link.type !== 'structure' &&
        link.type !== 'event' &&
        link.type !== 'encounter'
      ) {
        // TODO: Implement navigation for Kingdom, Location, Campaign in future tickets
        console.warn(`Navigation to ${link.type} not yet implemented`);
        return;
      }

      // Push current entity onto navigation stack
      if (entity) {
        setNavigationStack((prev) => [
          ...prev,
          {
            entityType: currentEntityType,
            entityId: currentEntityId,
            entityName: entity.name,
          },
        ]);
      }

      // Navigate to new entity
      setCurrentEntityType(link.type as EntityType);
      setCurrentEntityId(link.id);
    },
    [entity, currentEntityType, currentEntityId]
  );

  /**
   * Navigate back to previous entity
   */
  const handleGoBack = useCallback(() => {
    if (navigationStack.length === 0) return;

    // If there are unsaved changes, show confirmation dialog
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return;
    }

    const previous = navigationStack[navigationStack.length - 1];
    setCurrentEntityType(previous.entityType);
    setCurrentEntityId(previous.entityId);
    setNavigationStack((prev) => prev.slice(0, -1));
  }, [navigationStack, hasUnsavedChanges]);

  /**
   * Handle closing the inspector
   */
  const handleClose = useCallback(() => {
    // If there are unsaved changes, show confirmation dialog
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
      return;
    }

    onClose();
  }, [hasUnsavedChanges, onClose]);

  /**
   * Confirm discarding unsaved changes
   */
  const handleDiscardChanges = useCallback(() => {
    setHasUnsavedChanges(false);
    setIsEditing(false);
    setShowUnsavedDialog(false);
    // Proceed with the original action (close or navigate back)
    onClose();
  }, [onClose]);

  /**
   * Enter edit mode
   */
  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  /**
   * Handle dirty state changes from tabs
   */
  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setHasUnsavedChanges(isDirty);
  }, []);

  /**
   * Handle saving state changes from tabs
   */
  const handleSavingChange = useCallback((saving: boolean) => {
    setIsSaving(saving);
  }, []);

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            {/* Back button and breadcrumb navigation */}
            {navigationStack.length > 0 && (
              <div className="mb-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoBack}
                  className="h-8 px-2"
                  title="Go back to previous entity"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="text-sm">Back</span>
                </Button>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  {navigationStack.map((item, index) => (
                    <span key={index}>
                      {item.entityName} <span className="text-slate-400">›</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex-1">
                <SheetTitle>{getEntityTypeName(currentEntityType)} Inspector</SheetTitle>
                <SheetDescription>
                  {query.loading ? (
                    <span className="inline-block h-4 w-64 animate-pulse rounded-md bg-slate-100" />
                  ) : query.error ? (
                    <span className="text-red-500">Error loading {currentEntityType}</span>
                  ) : entity ? (
                    <>Viewing details for {entity.name}</>
                  ) : (
                    <>No {currentEntityType} found</>
                  )}
                </SheetDescription>
              </div>

              {/* Edit mode controls and resolution button */}
              {!query.loading && !query.error && entity && (
                <div className="flex items-center gap-2">
                  {/* Resolution button (only for Event and Encounter entities) */}
                  {(currentEntityType === 'event' || currentEntityType === 'encounter') && (
                    <ResolutionButton
                      entityType={currentEntityType}
                      isResolved={
                        currentEntityType === 'event'
                          ? (entity as { isCompleted: boolean }).isCompleted
                          : (entity as { isResolved: boolean }).isResolved
                      }
                      loading={isResolving}
                      onClick={() => setShowResolutionDialog(true)}
                      className="h-8 px-2"
                    />
                  )}

                  {/* Edit mode controls */}
                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEditing}
                        disabled={isSaving}
                        className="h-8 px-2"
                        title="Cancel editing"
                      >
                        <X className="h-4 w-4 mr-1" />
                        <span className="text-sm">Cancel</span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-8 px-2"
                        title={isSaving ? 'Saving...' : 'Save changes'}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        <span className="text-sm">{isSaving ? 'Saving...' : 'Save'}</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEditing}
                      className="h-8 px-2"
                      title="Edit entity"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      <span className="text-sm">Edit</span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </SheetHeader>

          {query.error ? (
            <div className="mt-6 p-4 border border-red-200 bg-red-50 rounded-md">
              <h3 className="text-sm font-semibold text-red-800">Error Loading Entity</h3>
              <p className="text-sm text-red-600 mt-2">{query.error.message}</p>
              <button
                onClick={() => query.refetch()}
                className="mt-3 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : query.loading ? (
            <div className="mt-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !entity ? (
            <div className="mt-6 p-4 border border-slate-200 bg-slate-50 rounded-md">
              <p className="text-sm text-slate-600">
                {getEntityTypeName(currentEntityType)} not found
              </p>
            </div>
          ) : (
            <Tabs defaultValue="overview" className="mt-6">
              <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="links">Links</TabsTrigger>
                <TabsTrigger value="conditions">Conditions</TabsTrigger>
                <TabsTrigger value="effects">Effects</TabsTrigger>
                <TabsTrigger value="versions">Versions</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <OverviewTab
                  entity={entity}
                  entityType={currentEntityType}
                  isEditing={isEditing}
                  saveRef={tabSaveRef}
                  onSaveComplete={() => {
                    setHasUnsavedChanges(false);
                    setIsEditing(false);
                  }}
                  onCancel={handleCancelEditing}
                  onDirtyChange={handleDirtyChange}
                  onSavingChange={handleSavingChange}
                />
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                {currentEntityType === 'settlement' ? (
                  <SettlementPanel
                    settlement={entity as NonNullable<typeof settlementQuery.settlement>}
                  />
                ) : currentEntityType === 'structure' ? (
                  <StructurePanel
                    structure={entity as NonNullable<typeof structureQuery.structure>}
                    onStructureDeleted={onClose}
                  />
                ) : currentEntityType === 'event' ? (
                  <EventPanel event={entity as NonNullable<typeof eventQuery.event>} />
                ) : (
                  <EncounterPanel
                    encounter={entity as NonNullable<typeof encounterQuery.encounter>}
                  />
                )}
              </TabsContent>

              <TabsContent value="links" className="space-y-4">
                <LinksTab
                  entityType={currentEntityType}
                  entityId={currentEntityId}
                  onNavigate={handleNavigate}
                />
              </TabsContent>

              <TabsContent value="conditions" className="space-y-4">
                <ConditionsTab
                  entityType={getEntityTypeName(currentEntityType)}
                  entityId={currentEntityId}
                />
              </TabsContent>

              <TabsContent value="effects" className="space-y-4">
                <EffectsTab
                  entityType={getEntityTypeName(currentEntityType)}
                  entityId={currentEntityId}
                />
              </TabsContent>

              <TabsContent value="versions" className="space-y-4">
                <VersionsTab entityType={currentEntityType} entityId={currentEntityId} />
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* Unsaved changes confirmation dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnsavedDialog(false)}>
              Keep Editing
            </Button>
            <Button variant="destructive" onClick={handleDiscardChanges}>
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolution dialog (for Event/Encounter entities) */}
      {entity && (currentEntityType === 'event' || currentEntityType === 'encounter') && (
        <ResolutionDialog
          entityType={currentEntityType}
          entityName={entity.name}
          effects={allEffects || []}
          validation={validationResult}
          loading={isResolving}
          error={null}
          success={false}
          isOpen={showResolutionDialog}
          onConfirm={handleResolutionConfirm}
          onCancel={() => setShowResolutionDialog(false)}
        />
      )}
    </>
  );
}
