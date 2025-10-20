import { ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettlementDetails, useStructureDetails } from '@/services/api/hooks';

import { ConditionsTab } from './ConditionsTab';
import { EffectsTab } from './EffectsTab';
import { LinksTab, type EntityLink } from './LinksTab';
import { OverviewTab } from './OverviewTab';
import { SettlementPanel } from './SettlementPanel';
import { StructurePanel } from './StructurePanel';
import { VersionsTab } from './VersionsTab';

export type EntityType = 'settlement' | 'structure';

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

  // Reset navigation when inspector opens with new entity
  useEffect(() => {
    if (isOpen) {
      setCurrentEntityType(entityType);
      setCurrentEntityId(entityId);
      setNavigationStack([]);
    }
  }, [isOpen, entityType, entityId]);

  // Conditionally fetch entity data based on type
  const settlementQuery = useSettlementDetails(currentEntityId, {
    skip: currentEntityType !== 'settlement',
  });
  const structureQuery = useStructureDetails(currentEntityId, {
    skip: currentEntityType !== 'structure',
  });

  // Determine which query to use based on entity type
  const query = currentEntityType === 'settlement' ? settlementQuery : structureQuery;
  const entity =
    currentEntityType === 'settlement' ? settlementQuery.settlement : structureQuery.structure;

  /**
   * Navigate to a related entity
   */
  const handleNavigate = (link: EntityLink) => {
    // Only navigate to settlement or structure (skip kingdom, location, campaign for now)
    if (link.type !== 'settlement' && link.type !== 'structure') {
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
  };

  /**
   * Navigate back to previous entity
   */
  const handleGoBack = () => {
    if (navigationStack.length === 0) return;

    const previous = navigationStack[navigationStack.length - 1];
    setCurrentEntityType(previous.entityType);
    setCurrentEntityId(previous.entityId);
    setNavigationStack((prev) => prev.slice(0, -1));
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
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

          <SheetTitle>
            {currentEntityType === 'settlement' ? 'Settlement' : 'Structure'} Inspector
          </SheetTitle>
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
              {entityType === 'settlement' ? 'Settlement' : 'Structure'} not found
            </p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
              <TabsTrigger value="conditions">Conditions</TabsTrigger>
              <TabsTrigger value="effects">Effects</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <OverviewTab entity={entity} entityType={currentEntityType} />
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              {currentEntityType === 'settlement' ? (
                <SettlementPanel
                  settlement={entity as NonNullable<typeof settlementQuery.settlement>}
                />
              ) : (
                <StructurePanel
                  structure={entity as NonNullable<typeof structureQuery.structure>}
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
                entityType={currentEntityType === 'settlement' ? 'Settlement' : 'Structure'}
                entityId={currentEntityId}
              />
            </TabsContent>

            <TabsContent value="effects" className="space-y-4">
              <EffectsTab
                entityType={currentEntityType === 'settlement' ? 'Settlement' : 'Structure'}
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
  );
}
