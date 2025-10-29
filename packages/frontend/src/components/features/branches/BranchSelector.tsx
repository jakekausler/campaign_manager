import { ChevronDown, GitBranch, AlertCircle, Check, GitFork } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetBranchHierarchy, type Branch } from '@/services/api/hooks';
import { useCampaignStore } from '@/stores';

import { ForkBranchDialog } from './ForkBranchDialog';

/**
 * BranchSelector Component
 *
 * Dropdown component for selecting and switching between campaign branches.
 * Displays branch hierarchy with indentation, shows current branch prominently,
 * and provides branch metadata on hover.
 *
 * Features:
 * - Hierarchical branch display with indentation for child branches
 * - Current branch highlighted with check mark
 * - Branch metadata (divergedAt timestamp, creation date)
 * - Loading and error states
 * - Mobile-friendly sheet/drawer UI
 *
 * @example
 * ```tsx
 * function Header() {
 *   return (
 *     <nav>
 *       <BranchSelector />
 *     </nav>
 *   );
 * }
 * ```
 */
export function BranchSelector() {
  const { currentCampaignId, currentBranchId, setCurrentBranch } = useCampaignStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false);

  // Fetch branch hierarchy for current campaign
  const { flatBranches, loading, error } = useGetBranchHierarchy({
    variables: { campaignId: currentCampaignId ?? '' },
    skip: !currentCampaignId,
  });

  // Find current branch object for display
  const currentBranch = useMemo(() => {
    return flatBranches.find((b) => b.id === currentBranchId) ?? null;
  }, [flatBranches, currentBranchId]);

  // Handle branch selection with instant UI update
  const handleSelectBranch = (branchId: string) => {
    setCurrentBranch(branchId);
    setIsOpen(false);
  };

  // Handle fork button click
  const handleForkClick = () => {
    setIsForkDialogOpen(true);
  };

  // Handle fork success
  const handleForkSuccess = () => {
    // Close both dialogs
    setIsForkDialogOpen(false);
    setIsOpen(false);
  };

  // If no campaign selected, don't render
  if (!currentCampaignId) {
    return null;
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 min-w-[200px]"
            data-testid="branch-selector-trigger"
          >
            <GitBranch className="h-4 w-4" />
            <span className="truncate flex-1 text-left">
              {currentBranch?.name ?? 'Select Branch'}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </SheetTrigger>

        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Select Branch</SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleForkClick}
                disabled={!currentBranch}
                title={currentBranch ? 'Fork this branch' : 'Select a branch first'}
                data-testid="fork-branch-button"
              >
                <GitFork className="h-4 w-4 mr-2" />
                Fork
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Loading state */}
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {/* Error state */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to load branches: {error.message}</AlertDescription>
              </Alert>
            )}

            {/* Branch list */}
            {!loading && !error && flatBranches.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No branches found for this campaign. Create a branch to get started.
                </AlertDescription>
              </Alert>
            )}

            {!loading && !error && flatBranches.length > 0 && (
              <div className="space-y-1" data-testid="branch-list">
                {flatBranches.map((branch) => (
                  <BranchItem
                    key={branch.id}
                    branch={branch}
                    depth={branch.depth}
                    isSelected={branch.id === currentBranchId}
                    onSelect={handleSelectBranch}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Fork Branch Dialog */}
      <ForkBranchDialog
        sourceBranch={currentBranch}
        isOpen={isForkDialogOpen}
        onClose={() => setIsForkDialogOpen(false)}
        onSuccess={handleForkSuccess}
      />
    </>
  );
}

/**
 * BranchItem Component
 *
 * Individual branch item in the branch list.
 * Shows branch name, metadata, and indentation based on hierarchy depth.
 *
 * @internal
 */
interface BranchItemProps {
  branch: Branch & { depth: number };
  depth: number;
  isSelected: boolean;
  onSelect: (branchId: string) => void;
}

function BranchItem({ branch, depth, isSelected, onSelect }: BranchItemProps) {
  const handleClick = () => {
    onSelect(branch.id);
  };

  // Format divergedAt timestamp for display
  const divergedAtLabel = branch.divergedAt
    ? new Date(branch.divergedAt).toLocaleDateString()
    : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        w-full text-left px-3 py-3 rounded-md transition-colors
        hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring
        ${isSelected ? 'bg-accent' : ''}
      `}
      style={{ paddingLeft: `${12 + depth * 24}px` }}
      data-testid={`branch-item-${branch.id}`}
      aria-current={isSelected ? 'true' : 'false'}
    >
      <div className="flex items-start gap-3">
        {/* Selection indicator */}
        <div className="mt-0.5 h-4 w-4 flex-shrink-0">
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>

        {/* Branch info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{branch.name}</span>
            {divergedAtLabel && (
              <Badge variant="secondary" className="text-xs">
                {divergedAtLabel}
              </Badge>
            )}
          </div>

          {branch.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{branch.description}</p>
          )}

          {/* Branch metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {branch.divergedAt && (
              <span title="Diverged at">Forked {new Date(branch.divergedAt).toLocaleString()}</span>
            )}
            <span title="Created at">Created {new Date(branch.createdAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
