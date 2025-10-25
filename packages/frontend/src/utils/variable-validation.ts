/**
 * Validation utilities for typed variables
 *
 * Validates variable values against their schemas with type-specific rules.
 */

export interface VariableSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  enumValues?: string[];
  defaultValue?: unknown;
  description?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate a single variable value against its schema
 *
 * @param schema - Variable schema definition
 * @param value - Value to validate
 * @returns Error message if invalid, null if valid
 */
export function validateVariableValue(schema: VariableSchema, value: unknown): string | null {
  // Allow null/undefined to fall back to default value
  if (value === null || value === undefined || value === '') {
    return null;
  }

  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        return 'Must be text';
      }
      return null;

    case 'number':
      if (typeof value === 'string') {
        // Allow string representation of numbers for form inputs
        const num = parseFloat(value);
        if (isNaN(num)) {
          return 'Must be a valid number';
        }
        return null;
      }
      if (typeof value !== 'number' || isNaN(value)) {
        return 'Must be a number';
      }
      return null;

    case 'boolean':
      if (typeof value !== 'boolean') {
        return 'Must be true or false';
      }
      return null;

    case 'enum':
      if (!schema.enumValues || schema.enumValues.length === 0) {
        return 'Enum type requires enumValues to be defined';
      }
      if (typeof value !== 'string') {
        return 'Must be a string';
      }
      if (!schema.enumValues.includes(value)) {
        return `Must be one of: ${schema.enumValues.join(', ')}`;
      }
      return null;

    default:
      return `Unknown variable type: ${schema.type}`;
  }
}

/**
 * Validate all variables against their schemas
 *
 * @param schemas - Array of variable schemas
 * @param values - Current variable values
 * @returns Object mapping field names to error messages
 */
export function validateAllVariables(
  schemas: VariableSchema[],
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const schema of schemas) {
    const value = values[schema.name];
    const error = validateVariableValue(schema, value);
    if (error) {
      errors[schema.name] = error;
    }
  }

  return errors;
}

/**
 * Convert form values to the correct types based on schemas
 *
 * This is needed because HTML form inputs always return strings,
 * so we need to convert them to numbers/booleans as appropriate.
 *
 * @param schemas - Array of variable schemas
 * @param values - Raw form values (strings)
 * @returns Typed values
 */
export function convertFormValues(
  schemas: VariableSchema[],
  values: Record<string, unknown>
): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const schema of schemas) {
    const rawValue = values[schema.name];

    // Skip if no value provided
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      // Use default value if available
      if (schema.defaultValue !== undefined) {
        converted[schema.name] = schema.defaultValue;
      }
      continue;
    }

    switch (schema.type) {
      case 'string':
      case 'enum':
        converted[schema.name] = String(rawValue);
        break;

      case 'number':
        if (typeof rawValue === 'string') {
          const num = parseFloat(rawValue);
          if (!isNaN(num)) {
            converted[schema.name] = num;
          }
        } else if (typeof rawValue === 'number') {
          converted[schema.name] = rawValue;
        }
        break;

      case 'boolean':
        // Handle checkbox values (true/false) or string representations
        if (typeof rawValue === 'boolean') {
          converted[schema.name] = rawValue;
        } else if (typeof rawValue === 'string') {
          converted[schema.name] = rawValue === 'true';
        }
        break;

      default:
        converted[schema.name] = rawValue;
    }
  }

  return converted;
}
