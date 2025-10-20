import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export interface Entity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  computedFields?: Record<string, unknown>;
  description?: string;
  [key: string]: unknown;
}

export interface OverviewTabProps {
  /** The entity to display */
  entity: Entity;
  /** Type of entity (settlement or structure) */
  entityType: 'settlement' | 'structure';
}

/**
 * OverviewTab displays basic entity information, description, and computed fields.
 *
 * Features:
 * - Basic entity metadata (ID, name, timestamps)
 * - Optional description field
 * - Computed fields with JSON formatting
 * - Copy-to-clipboard functionality
 */
export function OverviewTab({ entity, entityType }: OverviewTabProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /**
   * Copy text to clipboard and show temporary success indicator
   */
  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      // Reset after 2 seconds
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  /**
   * Format a value for display (handles dates, objects, primitives)
   */
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  /**
   * Render a field row with label, value, and copy button
   */
  const renderField = (label: string, value: unknown, fieldKey: string) => {
    const formattedValue = formatValue(value);
    const isCopied = copiedField === fieldKey;

    return (
      <div key={fieldKey} className="flex flex-col gap-1">
        <Label className="text-xs font-semibold text-slate-700">{label}:</Label>
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

  return (
    <div className="space-y-6">
      {/* Basic Information Section */}
      <Card className="p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Basic Information</h3>
        <div className="space-y-3">
          {renderField('ID', entity.id, 'id')}
          {renderField('Name', entity.name, 'name')}
          {renderField('Created', new Date(entity.createdAt).toLocaleString(), 'createdAt')}
          {renderField('Updated', new Date(entity.updatedAt).toLocaleString(), 'updatedAt')}
        </div>
      </Card>

      {/* Description Section (if available) */}
      {entity.description && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Description</h3>
          <div className="space-y-3">
            {renderField('Description', entity.description, 'description')}
          </div>
        </Card>
      )}

      {/* Computed Fields Section */}
      {entity.computedFields && Object.keys(entity.computedFields).length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Computed Fields</h3>
          <div className="space-y-3">
            {Object.entries(entity.computedFields).map(([key, value]) =>
              renderField(
                // Convert snake_case to Title Case
                key
                  .split('_')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' '),
                value,
                `computedFields.${key}`
              )
            )}
          </div>
        </Card>
      )}

      {/* Empty State if no computed fields */}
      {(!entity.computedFields || Object.keys(entity.computedFields).length === 0) && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Computed Fields</h3>
          <p className="text-sm text-slate-500 italic">
            No computed fields available for this {entityType}
          </p>
        </Card>
      )}
    </div>
  );
}
