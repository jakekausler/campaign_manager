import { useState, useRef, useEffect, useMemo, useId } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface VariableOption {
  /** The full path to the variable (e.g., 'settlement.name', 'structure.level') */
  path: string;
  /** The data type of the variable */
  type: 'string' | 'number' | 'boolean' | 'enum' | 'unknown';
  /** Category for grouping (Settlement, Structure, Common, etc.) */
  category: string;
  /** Optional human-readable description */
  description?: string;
}

export interface VariablePickerInputProps {
  /** Available variables to choose from */
  variables: VariableOption[];
  /** Currently selected variable path */
  value: string;
  /** Callback when variable is selected or manually entered */
  onChange: (path: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * VariablePickerInput provides an autocomplete input for selecting variable paths
 *
 * Features:
 * - Dropdown with all available variables
 * - Search/filter by variable path
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Categorized grouping
 * - Type hints and descriptions
 * - Manual text entry for custom paths
 * - Accessible ARIA attributes
 *
 * @example
 * ```tsx
 * <VariablePickerInput
 *   variables={availableVariables}
 *   value={selectedPath}
 *   onChange={setSelectedPath}
 * />
 * ```
 */
export function VariablePickerInput({
  variables,
  value,
  onChange,
  placeholder = 'Select a variable...',
  className,
}: VariablePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [inputText, setInputText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Sync inputText with value prop when it changes externally
  useEffect(() => {
    setInputText(value);
  }, [value]);

  // Filter variables based on current input text (memoized for performance)
  const filteredVariables = useMemo(
    () =>
      inputText
        ? variables.filter((v) => v.path.toLowerCase().includes(inputText.toLowerCase()))
        : variables,
    [inputText, variables]
  );

  // Group filtered variables by category (memoized for performance)
  const groupedVariables = useMemo(
    () =>
      filteredVariables.reduce<Record<string, VariableOption[]>>((acc, variable) => {
        if (!acc[variable.category]) {
          acc[variable.category] = [];
        }
        acc[variable.category].push(variable);
        return acc;
      }, {}),
    [filteredVariables]
  );

  // Flatten grouped variables for keyboard navigation (memoized for performance)
  const flatOptions = useMemo(
    () => Object.entries(groupedVariables).flatMap(([_, opts]) => opts),
    [groupedVariables]
  );

  // Create a lookup map for O(1) index lookups (avoids O(n²) in render loop)
  const pathToIndexMap = useMemo(
    () => new Map(flatOptions.map((opt, idx) => [opt.path, idx])),
    [flatOptions]
  );

  // Handle input change (manual typing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Handle input focus
  const handleFocus = () => {
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  // Handle clicking on an option
  const handleOptionClick = (path: string) => {
    setInputText(path);
    onChange(path);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (flatOptions.length > 0) {
          setHighlightedIndex((prev) => (prev + 1) % flatOptions.length);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (flatOptions.length > 0) {
          setHighlightedIndex((prev) => (prev - 1 + flatOptions.length) % flatOptions.length);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (flatOptions.length > 0 && flatOptions[highlightedIndex]) {
          handleOptionClick(flatOptions[highlightedIndex].path);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;

      case 'Tab':
        setIsOpen(false);
        setHighlightedIndex(0);
        break;
    }
  };

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.querySelector('[data-highlighted="true"]');
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && flatOptions.length > 0 && highlightedIndex >= 0 && flatOptions[highlightedIndex]
            ? `${listboxId}-option-${highlightedIndex}`
            : undefined
        }
        className="w-full"
      />

      {isOpen && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-96 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {filteredVariables.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No variables found</div>
          ) : (
            Object.entries(groupedVariables).map(([category, options]) => (
              <div key={category} className="py-1">
                {/* Category header */}
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {category}
                </div>

                {/* Category options */}
                {options.map((option) => {
                  const globalIndex = pathToIndexMap.get(option.path) ?? -1;
                  const isHighlighted = globalIndex === highlightedIndex;

                  return (
                    <div
                      key={option.path}
                      id={`${listboxId}-option-${globalIndex}`}
                      role="option"
                      aria-selected={option.path === inputText}
                      data-highlighted={isHighlighted}
                      onClick={() => handleOptionClick(option.path)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOptionClick(option.path);
                        }
                      }}
                      tabIndex={0}
                      className={cn(
                        'px-3 py-2 cursor-pointer transition-colors',
                        isHighlighted ? 'bg-slate-100' : 'hover:bg-slate-50',
                        option.path === inputText && 'bg-blue-50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{option.path}</span>
                        <span
                          className={cn(
                            'text-xs font-mono px-1.5 py-0.5 rounded',
                            'bg-slate-100 text-slate-600'
                          )}
                        >
                          {option.type}
                        </span>
                      </div>
                      {option.description && (
                        <div className="mt-0.5 text-xs text-slate-500">{option.description}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
