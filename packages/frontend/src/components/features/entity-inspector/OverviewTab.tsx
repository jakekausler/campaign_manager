import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Button, Card, Label } from '@/components/ui';
import { useEditMode } from '@/hooks';
import { useUpdateSettlement, useUpdateStructure } from '@/services/api/mutations';

import { EditableField } from './EditableField';

export interface Entity {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  computedFields?: Record<string, unknown>;
  description?: string | null;
  [key: string]: unknown;
}

export interface OverviewTabProps {
  /** The entity to display */
  entity: Entity;
  /** Type of entity (settlement, structure, event, or encounter) */
  entityType: 'settlement' | 'structure' | 'event' | 'encounter';
  /** Whether edit mode is active */
  isEditing?: boolean;
  /** Ref to expose save function to parent */
  saveRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
  /** Callback when save completes successfully */
  onSaveComplete?: () => void;
  /** Callback when edit mode is cancelled */
  onCancel?: () => void;
  /** Callback when dirty state changes */
  onDirtyChange?: (isDirty: boolean) => void;
  /** Callback when saving state changes */
  onSavingChange?: (isSaving: boolean) => void;
}

/**
 * OverviewTab displays basic entity information, description, and computed fields.
 *
 * Features:
 * - Basic entity metadata (ID, name, timestamps)
 * - Optional description field
 * - Computed fields with JSON formatting
 * - Copy-to-clipboard functionality
 * - Inline editing for name field
 */
export function OverviewTab({
  entity,
  entityType,
  isEditing = false,
  saveRef,
  onSaveComplete,
  onCancel,
  onDirtyChange,
  onSavingChange,
}: OverviewTabProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Mutation hooks based on entity type
  const { updateSettlement } = useUpdateSettlement();
  const { updateStructure } = useUpdateStructure();

  // Stable callbacks for useEditMode
  const handleSave = useCallback(
    async (data: { name: string }) => {
      // Call appropriate mutation based on entity type
      if (entityType === 'settlement') {
        await updateSettlement(entity.id, { name: data.name });
      } else {
        await updateStructure(entity.id, { name: data.name });
      }
      onSaveComplete?.();
    },
    [entityType, entity.id, updateSettlement, updateStructure, onSaveComplete]
  );

  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const validateField = useCallback((field: string, value: unknown) => {
    if (field === 'name' && (!value || String(value).trim() === '')) {
      return 'Name is required';
    }
    return undefined;
  }, []);

  // Memoize initialData to prevent infinite re-renders
  const initialData = useMemo(
    () => ({
      name: entity.name,
    }),
    [entity.name]
  );

  // Edit mode state management
  const {
    data: editData,
    isDirty,
    isSaving,
    updateField,
    save: saveEditMode,
    errors,
  } = useEditMode({
    initialData,
    onSave: handleSave,
    onCancel: handleCancel,
    validate: validateField,
  });

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  // Notify parent of saving state changes
  useEffect(() => {
    onSavingChange?.(isSaving);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving]);

  // Expose save function to parent via ref
  useEffect(() => {
    if (saveRef) {
      saveRef.current = saveEditMode;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveEditMode]);

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
  const renderField = (label: string, value: unknown, fieldKey: string): ReactNode => {
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

          {/* Editable Name Field */}
          {isEditing ? (
            <EditableField
              label="Name"
              value={editData.name}
              isEditing={isEditing}
              onChange={(value) => updateField('name', value as string)}
              type="text"
              error={errors.find((e) => e.field === 'name')?.message}
              showCopy={false}
            />
          ) : (
            renderField('Name', entity.name, 'name')
          )}

          {renderField('Created', new Date(entity.createdAt).toLocaleString(), 'createdAt')}
          {renderField('Updated', new Date(entity.updatedAt).toLocaleString(), 'updatedAt')}
        </div>
      </Card>

      {/* Event-specific fields */}
      {entityType === 'event' && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Event Information</h3>
          <div className="space-y-3">
            {entity.eventType ? renderField('Event Type', entity.eventType, 'eventType') : null}
            {entity.scheduledAt
              ? renderField(
                  'Scheduled At',
                  new Date(entity.scheduledAt as string).toLocaleString(),
                  'scheduledAt'
                )
              : null}
            {entity.occurredAt
              ? renderField(
                  'Occurred At',
                  new Date(entity.occurredAt as string).toLocaleString(),
                  'occurredAt'
                )
              : null}
            {entity.isCompleted !== undefined
              ? renderField('Status', entity.isCompleted ? 'Completed' : 'Pending', 'isCompleted')
              : null}
          </div>
        </Card>
      )}

      {/* Encounter-specific fields */}
      {entityType === 'encounter' && (
        <Card className="p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Encounter Information</h3>
          <div className="space-y-3">
            {entity.difficulty !== undefined
              ? renderField('Difficulty', entity.difficulty, 'difficulty')
              : null}
            {entity.scheduledAt
              ? renderField(
                  'Scheduled At',
                  new Date(entity.scheduledAt as string).toLocaleString(),
                  'scheduledAt'
                )
              : null}
            {entity.resolvedAt
              ? renderField(
                  'Resolved At',
                  new Date(entity.resolvedAt as string).toLocaleString(),
                  'resolvedAt'
                )
              : null}
            {entity.isResolved !== undefined
              ? renderField('Status', entity.isResolved ? 'Resolved' : 'Unresolved', 'isResolved')
              : null}
          </div>
        </Card>
      )}

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
