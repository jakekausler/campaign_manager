import { Beer, BookOpen, Castle, Church, Hammer, Loader2, Store, Swords } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateStructure, type CreateStructureInput } from '@/services/api/mutations/structures';

/**
 * Available structure types with their display names and icons
 */
export const STRUCTURE_TYPES = [
  { value: 'temple', label: 'Temple', icon: Church },
  { value: 'barracks', label: 'Barracks', icon: Swords },
  { value: 'market', label: 'Market', icon: Store },
  { value: 'library', label: 'Library', icon: BookOpen },
  { value: 'forge', label: 'Forge', icon: Hammer },
  { value: 'tavern', label: 'Tavern', icon: Beer },
  { value: 'fortress', label: 'Fortress', icon: Castle },
  { value: 'citadel', label: 'Citadel', icon: Castle },
] as const;

/**
 * Form data for creating a new structure
 */
export interface StructureFormData {
  name: string;
  type: string;
  level: number;
}

/**
 * Validation errors for structure form
 */
export interface StructureFormErrors {
  name?: string;
  type?: string;
  level?: string;
}

/**
 * Props for AddStructureModal component
 */
export interface AddStructureModalProps {
  /** The settlement ID to add the structure to */
  settlementId: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is closed (cancelled or completed) */
  onClose: () => void;
  /** Callback when a structure is successfully created */
  onSuccess?: (structureId: string) => void;
}

/**
 * Validates structure form data
 */
function validateStructureForm(data: StructureFormData): StructureFormErrors {
  const errors: StructureFormErrors = {};

  // Validate name
  if (!data.name || data.name.trim() === '') {
    errors.name = 'Structure name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Structure name must be at least 2 characters';
  } else if (data.name.length > 100) {
    errors.name = 'Structure name must be less than 100 characters';
  }

  // Validate type
  if (!data.type) {
    errors.type = 'Structure type is required';
  } else if (!STRUCTURE_TYPES.find((t) => t.value === data.type)) {
    errors.type = 'Invalid structure type';
  }

  // Validate level
  if (data.level < 1) {
    errors.level = 'Level must be at least 1';
  } else if (data.level > 10) {
    errors.level = 'Level must be 10 or less';
  } else if (!Number.isInteger(data.level)) {
    errors.level = 'Level must be a whole number';
  }

  return errors;
}

/**
 * AddStructureModal component provides a form dialog for creating new structures.
 *
 * Features:
 * - Structure type selector with icons
 * - Name input field
 * - Initial level setting
 * - Form validation with error messages
 * - Loading state during creation
 * - Success/error handling
 * - Keyboard shortcuts (Enter to submit, Escape to cancel)
 *
 * @param props - Component props
 * @returns The AddStructureModal component
 *
 * @example
 * ```tsx
 * <AddStructureModal
 *   settlementId="settlement-123"
 *   isOpen={showModal}
 *   onClose={() => setShowModal(false)}
 *   onSuccess={(id) => console.log('Created structure:', id)}
 * />
 * ```
 */
export function AddStructureModal({
  settlementId,
  isOpen,
  onClose,
  onSuccess,
}: AddStructureModalProps): JSX.Element {
  // Form state
  const [formData, setFormData] = useState<StructureFormData>({
    name: '',
    type: STRUCTURE_TYPES[0].value,
    level: 1,
  });
  // Store level as string internally to allow empty/invalid values during editing
  const [levelInput, setLevelInput] = useState<string>('1');
  const [errors, setErrors] = useState<StructureFormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Mutation hook
  const { createStructure, loading, error: mutationError } = useCreateStructure();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        type: STRUCTURE_TYPES[0].value,
        level: 1,
      });
      setLevelInput('1');
      setErrors({});
      setTouched({});
    }
  }, [isOpen]);

  // Handle field changes
  const handleChange = (field: keyof StructureFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // Mark all fields as touched
    setTouched({ name: true, type: true, level: true });

    // Validate form
    const validationErrors = validateStructureForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      // TODO: Once backend is available, we'll need x, y coordinates
      // For now, we'll use placeholder values (0, 0)
      const input: CreateStructureInput = {
        settlementId,
        name: formData.name.trim(),
        type: formData.type,
        level: formData.level,
        x: 0,
        y: 0,
      };

      const result = await createStructure(input);

      if (result) {
        // Success! Close modal and notify parent
        onSuccess?.(result.id);
        onClose();
      }
    } catch (err) {
      // Error is handled by mutationError state
      console.error('Failed to create structure:', err);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Add New Structure</DialogTitle>
          <DialogDescription>
            Create a new structure in this settlement. Choose a type, name, and initial level.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Structure Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="structure-type">Structure Type *</Label>
            <div className="grid grid-cols-4 gap-2">
              {STRUCTURE_TYPES.map((structureType) => {
                const Icon = structureType.icon;
                const isSelected = formData.type === structureType.value;

                return (
                  <button
                    key={structureType.value}
                    type="button"
                    className={`
                      flex flex-col items-center gap-1 p-3 rounded-md border-2 transition-all
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                      }
                    `}
                    onClick={() => handleChange('type', structureType.value)}
                    aria-label={`Select ${structureType.label}`}
                    aria-pressed={isSelected}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{structureType.label}</span>
                  </button>
                );
              })}
            </div>
            {touched.type && errors.type && (
              <p className="text-sm text-red-600" role="alert">
                {errors.type}
              </p>
            )}
          </div>

          {/* Structure Name */}
          <div className="space-y-2">
            <Label htmlFor="structure-name">Structure Name *</Label>
            <Input
              id="structure-name"
              type="text"
              placeholder="e.g., Grand Temple of Light"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={touched.name && errors.name ? 'border-red-500' : ''}
              disabled={loading}
              aria-invalid={touched.name && errors.name ? 'true' : 'false'}
              aria-describedby={touched.name && errors.name ? 'name-error' : undefined}
            />
            {touched.name && errors.name && (
              <p id="name-error" className="text-sm text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Initial Level */}
          <div className="space-y-2">
            <Label htmlFor="structure-level">Initial Level *</Label>
            <Input
              id="structure-level"
              type="text"
              inputMode="numeric"
              value={levelInput}
              onChange={(e) => {
                const rawValue = e.target.value;
                setLevelInput(rawValue);

                // Parse to number for validation
                let numericValue: number;
                if (rawValue === '') {
                  numericValue = 0; // Treat empty as 0 for validation
                } else {
                  numericValue = parseFloat(rawValue);
                  if (isNaN(numericValue)) {
                    numericValue = 0;
                  }
                }

                handleChange('level', numericValue);
              }}
              className={touched.level && errors.level ? 'border-red-500' : ''}
              disabled={loading}
              aria-invalid={touched.level && errors.level ? 'true' : 'false'}
              aria-describedby={touched.level && errors.level ? 'level-error' : undefined}
            />
            {touched.level && errors.level && (
              <p id="level-error" className="text-sm text-red-600" role="alert">
                {errors.level}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Set the starting level (1-10) for this structure.
            </p>
          </div>

          {/* Mutation Error */}
          {mutationError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {mutationError.message}
              </p>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Structure'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
