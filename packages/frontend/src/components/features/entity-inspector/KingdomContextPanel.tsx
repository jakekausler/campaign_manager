import { Crown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useKingdomById, useSettlementsByKingdom } from '@/services/api/hooks';

export interface KingdomContextPanelProps {
  /** The ID of the kingdom to display */
  kingdomId: string;
  /** Optional settlement name for context */
  settlementName?: string;
}

/**
 * KingdomContextPanel displays Settlement's parent Kingdom information.
 *
 * Features:
 * - Kingdom name and level display
 * - Total settlements count for the kingdom
 * - "Navigate to Kingdom" button (placeholder for future Kingdom detail view)
 * - Loading skeleton and error states
 * - Kingdom-level stats relevant to settlements
 *
 * Integration:
 * - Uses useKingdomById hook to fetch kingdom data
 * - Uses useSettlementsByKingdom hook to count total settlements
 * - (Future) Will navigate to Kingdom detail view when implemented
 *
 * @example
 * ```tsx
 * <KingdomContextPanel
 *   kingdomId="kingdom-123"
 *   settlementName="Capital City"
 * />
 * ```
 */
export function KingdomContextPanel({ kingdomId, settlementName }: KingdomContextPanelProps) {
  const { kingdom, loading: kingdomLoading, error: kingdomError } = useKingdomById(kingdomId);
  const { settlements, loading: settlementsLoading } = useSettlementsByKingdom(kingdomId);

  const loading = kingdomLoading || settlementsLoading;
  const error = kingdomError;

  /**
   * Navigate to Kingdom detail view.
   * Currently a placeholder - Kingdom detail view may not exist yet.
   * Future: Navigate to /kingdoms/:id route
   */
  const handleNavigateToKingdom = () => {
    // TODO: Implement navigation to Kingdom detail view when it exists
    // navigate(`/kingdoms/${kingdomId}`);
    console.info('Kingdom detail view not yet implemented. Kingdom ID:', kingdomId);
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4" />
          Kingdom Context
        </h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Kingdom Name</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Kingdom Level</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-semibold text-slate-700">Total Settlements</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4" />
          Kingdom Context
        </h3>
        <div
          className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
          role="alert"
        >
          Failed to load kingdom: {error.message}
        </div>
      </Card>
    );
  }

  // Missing kingdom state
  if (!kingdom) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Crown className="w-4 h-4" />
          Kingdom Context
        </h3>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-500">
          No kingdom data available for this settlement.
        </div>
      </Card>
    );
  }

  const totalSettlements = settlements.length;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Crown className="w-4 h-4" />
        Kingdom Context
      </h3>

      <div className="space-y-3">
        {/* Kingdom Name */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Kingdom Name</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono">
            {kingdom.name}
          </div>
        </div>

        {/* Kingdom Level */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Kingdom Level</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono">
            Level {kingdom.level}
          </div>
        </div>

        {/* Total Settlements */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-semibold text-slate-700">Total Settlements</Label>
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono">
            {totalSettlements} {totalSettlements === 1 ? 'settlement' : 'settlements'}
          </div>
        </div>

        {/* Navigate to Kingdom Button (placeholder) */}
        <Button
          onClick={handleNavigateToKingdom}
          className="w-full"
          variant="outline"
          title="View Kingdom details (coming soon)"
        >
          <Crown className="w-4 h-4 mr-2" />
          Navigate to Kingdom
        </Button>

        {/* Settlement Context (if provided) */}
        {settlementName && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              <span className="font-semibold">{settlementName}</span> belongs to this kingdom
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
