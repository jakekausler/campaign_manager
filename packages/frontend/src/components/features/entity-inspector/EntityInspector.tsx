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

import { OverviewTab } from './OverviewTab';
import { SettlementPanel } from './SettlementPanel';
import { StructurePanel } from './StructurePanel';

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
 * EntityInspector component displays detailed information about an entity
 * in a side panel (Sheet) with tabbed navigation for different aspects
 * of the entity (Overview, Links, Conditions, Effects, Versions).
 */
export function EntityInspector({ entityType, entityId, isOpen, onClose }: EntityInspectorProps) {
  // Conditionally fetch entity data based on type
  const settlementQuery = useSettlementDetails(entityId, {
    skip: entityType !== 'settlement',
  });
  const structureQuery = useStructureDetails(entityId, {
    skip: entityType !== 'structure',
  });

  // Determine which query to use based on entity type
  const query = entityType === 'settlement' ? settlementQuery : structureQuery;
  const entity =
    entityType === 'settlement' ? settlementQuery.settlement : structureQuery.structure;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {entityType === 'settlement' ? 'Settlement' : 'Structure'} Inspector
          </SheetTitle>
          <SheetDescription>
            {query.loading ? (
              <span className="inline-block h-4 w-64 animate-pulse rounded-md bg-slate-100" />
            ) : query.error ? (
              <span className="text-red-500">Error loading {entityType}</span>
            ) : entity ? (
              <>Viewing details for this {entityType}</>
            ) : (
              <>No {entityType} found</>
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
              <OverviewTab entity={entity} entityType={entityType} />
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              {entityType === 'settlement' ? (
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
              <div className="text-sm text-slate-500">
                Links tab content will be implemented in Stage 8
              </div>
            </TabsContent>

            <TabsContent value="conditions" className="space-y-4">
              <div className="text-sm text-slate-500">
                Conditions tab content will be implemented in Stage 6
              </div>
            </TabsContent>

            <TabsContent value="effects" className="space-y-4">
              <div className="text-sm text-slate-500">
                Effects tab content will be implemented in Stage 7
              </div>
            </TabsContent>

            <TabsContent value="versions" className="space-y-4">
              <div className="text-sm text-slate-500">
                Versions tab content will be implemented in Stage 9
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
