import { ChevronRight } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  useSettlementDetails,
  useStructuresBySettlement,
  useStructureDetails,
} from '@/services/api/hooks';

/**
 * Entity information for navigation
 */
export interface EntityLink {
  id: string;
  name: string;
  type: 'settlement' | 'structure' | 'kingdom' | 'location' | 'campaign';
}

export interface LinksTabProps {
  /** The ID of the current entity */
  entityId: string;
  /** Type of entity (settlement or structure) */
  entityType: 'settlement' | 'structure';
  /** Callback when a related entity is clicked for navigation */
  onNavigate?: (entity: EntityLink) => void;
}

/**
 * LinksTab displays related entities with clickable navigation.
 *
 * Features:
 * - Displays all related entities based on entity type
 * - Settlement: Kingdom, Location, Campaign, Structures
 * - Structure: Settlement
 * - Clickable links trigger navigation via callback
 * - Loading and error states for async data
 */
export function LinksTab({ entityId, entityType, onNavigate }: LinksTabProps) {
  if (entityType === 'settlement') {
    return <SettlementLinks entityId={entityId} onNavigate={onNavigate} />;
  } else {
    return <StructureLinks entityId={entityId} onNavigate={onNavigate} />;
  }
}

/**
 * SettlementLinks component displays Settlement's related entities
 */
function SettlementLinks({
  entityId,
  onNavigate,
}: {
  entityId: string;
  onNavigate?: (entity: EntityLink) => void;
}) {
  const {
    settlement,
    loading: settlementLoading,
    error: settlementError,
  } = useSettlementDetails(entityId);
  const {
    structures,
    loading: structuresLoading,
    error: structuresError,
  } = useStructuresBySettlement(entityId);

  if (settlementLoading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading related entities...</p>
      </div>
    );
  }

  if (settlementError) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600">Error loading settlement: {settlementError.message}</p>
      </div>
    );
  }

  if (!settlement) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Settlement not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Parent Entities */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Parent Entities</h3>
        <div className="space-y-2">
          <LinkRow
            label="Kingdom"
            entityId={settlement.kingdomId}
            entityType="kingdom"
            onClick={onNavigate}
          />
          <LinkRow
            label="Location"
            entityId={settlement.locationId}
            entityType="location"
            onClick={onNavigate}
          />
          <LinkRow
            label="Campaign"
            entityId={settlement.campaignId}
            entityType="campaign"
            onClick={onNavigate}
          />
        </div>
      </Card>

      {/* Child Entities (Structures) */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Structures ({structuresLoading ? '...' : structures.length})
        </h3>
        {structuresError && (
          <p className="text-sm text-red-600 mb-2">
            Error loading structures: {structuresError.message}
          </p>
        )}
        {structuresLoading ? (
          <p className="text-sm text-slate-500">Loading structures...</p>
        ) : structures.length === 0 ? (
          <p className="text-sm text-slate-500">No structures in this settlement</p>
        ) : (
          <div className="space-y-2">
            {structures.map((structure) => (
              <LinkRow
                key={structure.id}
                label={structure.name}
                entityId={structure.id}
                entityType="structure"
                onClick={onNavigate}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * StructureLinks component displays Structure's related entities
 */
function StructureLinks({
  entityId,
  onNavigate,
}: {
  entityId: string;
  onNavigate?: (entity: EntityLink) => void;
}) {
  const { structure, loading, error } = useStructureDetails(entityId);

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading related entities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-600">Error loading structure: {error.message}</p>
      </div>
    );
  }

  if (!structure) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Structure not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Parent Entities */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Parent Entities</h3>
        <div className="space-y-2">
          <LinkRow
            label="Settlement"
            entityId={structure.settlementId}
            entityType="settlement"
            onClick={onNavigate}
          />
        </div>
      </Card>
    </div>
  );
}

/**
 * LinkRow component displays a single entity link with click handler
 */
function LinkRow({
  label,
  entityId,
  entityType,
  onClick,
}: {
  label: string;
  entityId: string;
  entityType: 'settlement' | 'structure' | 'kingdom' | 'location' | 'campaign';
  onClick?: (entity: EntityLink) => void;
}) {
  const handleClick = () => {
    if (onClick) {
      onClick({
        id: entityId,
        name: label,
        type: entityType,
      });
    }
  };

  return (
    <div
      className="flex items-center justify-between p-2 rounded-md bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors group"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      title={`Navigate to ${label}`}
    >
      <div className="flex items-center gap-2">
        <Label className="text-sm text-slate-700 cursor-pointer">{label}</Label>
        <span className="text-xs text-slate-500 font-mono">{entityId}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
    </div>
  );
}
