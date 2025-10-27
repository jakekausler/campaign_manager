import { ExternalLink, MapPin } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSettlementDetails } from '@/services/api/hooks';

/**
 * Props for the ParentSettlementContext component
 */
export interface ParentSettlementContextProps {
  /** The settlement ID to fetch and display */
  settlementId: string;
  /** Callback when "Navigate to Settlement" is clicked */
  onNavigateToSettlement?: (settlementId: string) => void;
}

/**
 * ParentSettlementContext displays information about a Structure's parent Settlement.
 *
 * Features:
 * - Settlement name and level display
 * - Navigation button to switch inspector to Settlement view
 * - Loading skeleton for async data fetching
 * - Error handling for missing or inaccessible settlements
 * - Fallback UI for missing settlement data
 *
 * Used in StructurePanel to show context about the parent Settlement.
 *
 * @example
 * ```tsx
 * <ParentSettlementContext
 *   settlementId={structure.settlementId}
 *   onNavigateToSettlement={(id) => setSelectedEntity({ type: 'settlement', id })}
 * />
 * ```
 */
export function ParentSettlementContext({
  settlementId,
  onNavigateToSettlement,
}: ParentSettlementContextProps) {
  const { settlement, loading, error } = useSettlementDetails(settlementId);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Parent Settlement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Name</Label>
            <Skeleton className="h-9 w-full" data-testid="settlement-name-skeleton" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Settlement Level</Label>
            <Skeleton className="h-9 w-24" data-testid="settlement-level-skeleton" />
          </div>
          <Skeleton className="h-10 w-full" data-testid="navigate-button-skeleton" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Parent Settlement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" role="alert">
            <AlertDescription data-testid="settlement-error">
              Error loading settlement: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Missing settlement state
  if (!settlement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-900">
            Parent Settlement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert role="status">
            <AlertDescription data-testid="settlement-not-found">
              Settlement not found or you don&apos;t have permission to view it.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-600" aria-hidden="true" />
          Parent Settlement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Settlement Name */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Name</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900">
            {settlement.name}
          </div>
        </div>

        {/* Settlement Level */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Settlement Level</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 w-24 text-center">
            {settlement.level !== undefined && settlement.level !== null ? settlement.level : 'N/A'}
          </div>
        </div>

        {/* Navigate to Settlement Button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onNavigateToSettlement?.(settlementId)}
          title="Open this settlement in the Entity Inspector"
        >
          <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
          Navigate to Settlement
        </Button>
      </CardContent>
    </Card>
  );
}
