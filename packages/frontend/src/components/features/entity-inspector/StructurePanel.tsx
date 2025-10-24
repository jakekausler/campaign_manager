import { useState, useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { LevelControl } from './LevelControl';

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
  [key: string]: unknown;
}

export interface StructurePanelProps {
  /** The structure entity to display */
  structure: StructureData;
}

/**
 * StructurePanel displays Structure-specific information.
 *
 * Features:
 * - Structure attributes (type, settlement, level, position, orientation)
 * - Typed variables from the variables JSON field
 * - Copy-to-clipboard functionality
 * - Automatic type-based formatting
 */
export function StructurePanel({ structure }: StructurePanelProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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
   * Convert snake_case to Title Case
   */
  const toTitleCase = (str: string): string => {
    return str
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
  const hasVariables = Object.keys(variables).length > 0;
  // Use type if available, fallback to typeId
  const structureType = structure.type || structure.typeId;

  return (
    <div className="space-y-6">
      {/* Structure Attributes Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Structure Attributes</h3>
        <div className="space-y-3">
          {renderField('Type', structureType, 'type')}
          {renderField('Settlement ID', structure.settlementId, 'settlementId')}

          {/* Level Control with increment/decrement buttons */}
          {structure.level !== undefined && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold text-slate-700">Level</Label>
              <LevelControl
                entityId={structure.id}
                entityType="structure"
                entityName={structure.name}
                currentLevel={structure.level}
                version={structure.version}
              />
            </div>
          )}

          {renderField('Position X', structure.x, 'x')}
          {renderField('Position Y', structure.y, 'y')}
          {renderField('Orientation', `${structure.orientation}°`, 'orientation')}
        </div>
      </Card>

      {/* Typed Variables Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Typed Variables</h3>
        {hasVariables ? (
          <div className="space-y-3">
            {Object.entries(variables).map(([key, value]) =>
              renderField(toTitleCase(key), value, `variable-${key}`)
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No typed variables available for this structure</p>
        )}
      </Card>
    </div>
  );
}
