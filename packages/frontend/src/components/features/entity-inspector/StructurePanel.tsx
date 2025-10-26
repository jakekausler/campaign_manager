import {
  Building2,
  Church,
  Swords,
  Store,
  BookOpen,
  Hammer,
  Beer,
  Castle,
  Trash2,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useUpdateStructure, useDeleteStructure } from '@/services/api/mutations/structures';

import { DeleteStructureConfirmationDialog } from './DeleteStructureConfirmationDialog';
import { LevelControl } from './LevelControl';
import { ParentSettlementContext } from './ParentSettlementContext';
import { TypedVariableEditor } from './TypedVariableEditor';

export interface VariableSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  description?: string;
  enumValues?: string[];
  defaultValue?: unknown;
}

export interface StructureData {
  id: string;
  name: string;
  typeId: string;
  type?: string;
  settlementId: string;
  level?: number;
  x: number;
  y: number;
  orientation: number;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  version?: number;
  computedFields?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  variableSchemas?: VariableSchema[];
  [key: string]: unknown;
}

export interface StructurePanelProps {
  /** The structure entity to display */
  structure: StructureData;
  /** Callback when opening parent settlement */
  onNavigateToSettlement?: (settlementId: string) => void;
  /** Callback when structure is deleted (optional) */
  onStructureDeleted?: (structureId: string) => void;
}

/**
 * Map structure type to icon component
 * @param type - The structure type (temple, barracks, market, etc.)
 * @returns React icon component with consistent sizing
 */
const getStructureIcon = (type?: string) => {
  const iconClass = 'h-5 w-5 shrink-0';
  switch (type?.toLowerCase()) {
    case 'temple':
      return <Church className={iconClass} />;
    case 'barracks':
      return <Swords className={iconClass} />;
    case 'market':
      return <Store className={iconClass} />;
    case 'library':
      return <BookOpen className={iconClass} />;
    case 'forge':
      return <Hammer className={iconClass} />;
    case 'tavern':
      return <Beer className={iconClass} />;
    case 'fortress':
    case 'citadel':
      return <Castle className={iconClass} />;
    default:
      return <Building2 className={iconClass} />;
  }
};

/**
 * Convert snake_case or PascalCase type to Title Case for display
 * @param str - The string to convert
 * @returns Title Case formatted string
 */
const formatTypeName = (str: string): string => {
  // Handle PascalCase: "SomeType" → "Some Type"
  const spacedPascal = str.replace(/([A-Z])/g, ' $1').trim();
  // Handle snake_case: "some_type" → "Some Type"
  return spacedPascal
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * StructurePanel displays Structure-specific information.
 *
 * Features:
 * - Structure type icon and label in header
 * - Delete structure button with confirmation
 * - Level control with increment/decrement
 * - Structure attributes (position, orientation)
 * - Typed variables editor with validation
 * - Parent settlement context and navigation
 * - Copy-to-clipboard functionality
 * - Automatic type-based formatting
 */
export function StructurePanel({
  structure,
  onNavigateToSettlement,
  onStructureDeleted,
}: StructurePanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { updateStructure } = useUpdateStructure();
  const { deleteStructure, loading: deleting } = useDeleteStructure();

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Copy text to clipboard and show temporary success indicator
   */
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      // Clear any existing timeout before setting a new one
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Reset after 2 seconds
      timeoutRef.current = setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  /**
   * Format a value for display based on its type
   */
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  /**
   * Handle saving updated variables
   */
  const handleSaveVariables = async (variables: Record<string, unknown>) => {
    try {
      await updateStructure(structure.id, {
        variables,
        expectedVersion: structure.version,
      });
      toast.success('Structure variables updated successfully');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update structure variables. Please try again.'
      );
      throw error; // Re-throw so TypedVariableEditor knows the save failed
    }
  };

  /**
   * Handle structure deletion
   */
  const handleConfirmDelete = async () => {
    try {
      await deleteStructure(structure.id);
      toast.success(`Structure "${structure.name}" deleted successfully`);
      setShowDeleteDialog(false);
      // Notify parent component that structure was deleted
      onStructureDeleted?.(structure.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete structure. Please try again.'
      );
    }
  };

  /**
   * Render a field row with label, value, and copy button
   */
  const renderField = (label: string, value: unknown, fieldKey: string) => {
    const formattedValue = formatValue(value);
    const isCopied = copiedField === fieldKey;

    return (
      <div key={fieldKey} className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        <div className="flex items-start gap-2">
          <div className="flex-1 p-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-900 font-mono break-all">
            {formattedValue}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(formattedValue, fieldKey)}
            className="shrink-0 h-8"
            title={isCopied ? 'Copied!' : 'Copy to clipboard'}
          >
            {isCopied ? (
              <span className="text-green-600">✓</span>
            ) : (
              <span className="text-slate-500">📋</span>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const variables = structure.variables || {};
  const variableSchemas = structure.variableSchemas || [];
  // Use type if available, fallback to typeId
  const structureType = structure.type || structure.typeId;
  const structureIcon = getStructureIcon(structureType);
  const formattedTypeName = formatTypeName(structureType);

  return (
    <div className="space-y-6">
      {/* Structure Type Header with Icon and Delete Button */}
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-slate-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
              {structureIcon}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Structure Type
              </p>
              <h2 className="text-lg font-bold text-slate-900" data-testid="structure-type-header">
                {formattedTypeName}
              </h2>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleting}
            className="shrink-0"
            title="Delete structure"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteStructureConfirmationDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        structureName={structure.name}
        structureType={formattedTypeName}
        loading={deleting}
      />

      {/* Parent Settlement Context */}
      <ParentSettlementContext
        settlementId={structure.settlementId}
        onNavigateToSettlement={onNavigateToSettlement}
      />

      {/* Level Control Section */}
      {structure.level !== undefined && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Level</h3>
          <LevelControl
            entityId={structure.id}
            entityType="structure"
            entityName={structure.name}
            currentLevel={structure.level}
            version={structure.version}
          />
        </Card>
      )}

      {/* Structure Attributes Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Attributes</h3>
        <div className="space-y-3">
          {renderField('Position X', structure.x, 'x')}
          {renderField('Position Y', structure.y, 'y')}
          {renderField('Orientation', `${structure.orientation}°`, 'orientation')}
        </div>
      </Card>

      {/* Typed Variables Section with Editor */}
      {variableSchemas.length > 0 && (
        <TypedVariableEditor
          entityId={structure.id}
          entityType="structure"
          variableSchemas={variableSchemas}
          currentVariables={variables}
          onSave={handleSaveVariables}
        />
      )}
    </div>
  );
}
