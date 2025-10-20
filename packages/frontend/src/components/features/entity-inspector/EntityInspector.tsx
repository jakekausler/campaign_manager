import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {entityType === 'settlement' ? 'Settlement' : 'Structure'} Inspector
          </SheetTitle>
          <SheetDescription>
            Viewing details for {entityType} {entityId}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="links">Links</TabsTrigger>
            <TabsTrigger value="conditions">Conditions</TabsTrigger>
            <TabsTrigger value="effects">Effects</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="text-sm text-slate-500">
              Overview tab content will be implemented in Stage 4
            </div>
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
      </SheetContent>
    </Sheet>
  );
}
