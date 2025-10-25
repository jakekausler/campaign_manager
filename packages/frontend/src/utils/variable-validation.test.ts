/**
 * Unit tests for variable validation utilities
 *
 * Tests validation functions including:
 * - validateVariableValue() for each type (string, number, boolean, enum)
 * - Null/undefined/empty value handling
 * - Enum membership validation
 * - Number parsing and validation
 * - Error message accuracy
 * - validateAllVariables() batch validation
 * - convertFormValues() type conversion
 * - Default value application
 */

import { describe, expect, it } from 'vitest';

import {
  type VariableSchema,
  validateVariableValue,
  validateAllVariables,
  convertFormValues,
} from './variable-validation';

describe('variable-validation', () => {
  describe('validateVariableValue', () => {
    describe('String Type', () => {
      const schema: VariableSchema = {
        name: 'test_string',
        type: 'string',
      };

      it('should validate valid string', () => {
        expect(validateVariableValue(schema, 'Hello World')).toBeNull();
      });

      it('should accept empty string', () => {
        expect(validateVariableValue(schema, '')).toBeNull();
      });

      it('should accept null', () => {
        expect(validateVariableValue(schema, null)).toBeNull();
      });

      it('should accept undefined', () => {
        expect(validateVariableValue(schema, undefined)).toBeNull();
      });

      it('should reject non-string values', () => {
        expect(validateVariableValue(schema, 123)).toBe('Must be text');
        expect(validateVariableValue(schema, true)).toBe('Must be text');
        expect(validateVariableValue(schema, {})).toBe('Must be text');
      });
    });

    describe('Number Type', () => {
      const schema: VariableSchema = {
        name: 'test_number',
        type: 'number',
      };

      it('should validate valid number', () => {
        expect(validateVariableValue(schema, 42)).toBeNull();
        expect(validateVariableValue(schema, 0)).toBeNull();
        expect(validateVariableValue(schema, -10)).toBeNull();
        expect(validateVariableValue(schema, 3.14)).toBeNull();
      });

      it('should validate string representation of numbers', () => {
        expect(validateVariableValue(schema, '42')).toBeNull();
        expect(validateVariableValue(schema, '3.14')).toBeNull();
        expect(validateVariableValue(schema, '-10')).toBeNull();
      });

      it('should accept empty string', () => {
        expect(validateVariableValue(schema, '')).toBeNull();
      });

      it('should accept null', () => {
        expect(validateVariableValue(schema, null)).toBeNull();
      });

      it('should accept undefined', () => {
        expect(validateVariableValue(schema, undefined)).toBeNull();
      });

      it('should reject invalid string representations', () => {
        expect(validateVariableValue(schema, 'not a number')).toBe('Must be a valid number');
        expect(validateVariableValue(schema, 'abc')).toBe('Must be a valid number');
      });

      it('should reject NaN', () => {
        expect(validateVariableValue(schema, NaN)).toBe('Must be a number');
      });

      it('should reject non-number values', () => {
        expect(validateVariableValue(schema, true)).toBe('Must be a number');
        expect(validateVariableValue(schema, {})).toBe('Must be a number');
      });
    });

    describe('Boolean Type', () => {
      const schema: VariableSchema = {
        name: 'test_boolean',
        type: 'boolean',
      };

      it('should validate true', () => {
        expect(validateVariableValue(schema, true)).toBeNull();
      });

      it('should validate false', () => {
        expect(validateVariableValue(schema, false)).toBeNull();
      });

      it('should accept null', () => {
        expect(validateVariableValue(schema, null)).toBeNull();
      });

      it('should accept undefined', () => {
        expect(validateVariableValue(schema, undefined)).toBeNull();
      });

      it('should accept empty string', () => {
        expect(validateVariableValue(schema, '')).toBeNull();
      });

      it('should reject non-boolean values', () => {
        expect(validateVariableValue(schema, 'true')).toBe('Must be true or false');
        expect(validateVariableValue(schema, 1)).toBe('Must be true or false');
        expect(validateVariableValue(schema, 0)).toBe('Must be true or false');
      });
    });

    describe('Enum Type', () => {
      const schema: VariableSchema = {
        name: 'test_enum',
        type: 'enum',
        enumValues: ['option1', 'option2', 'option3'],
      };

      it('should validate valid enum value', () => {
        expect(validateVariableValue(schema, 'option1')).toBeNull();
        expect(validateVariableValue(schema, 'option2')).toBeNull();
        expect(validateVariableValue(schema, 'option3')).toBeNull();
      });

      it('should accept empty string', () => {
        expect(validateVariableValue(schema, '')).toBeNull();
      });

      it('should accept null', () => {
        expect(validateVariableValue(schema, null)).toBeNull();
      });

      it('should accept undefined', () => {
        expect(validateVariableValue(schema, undefined)).toBeNull();
      });

      it('should reject invalid enum value', () => {
        const error = validateVariableValue(schema, 'invalid_option');
        expect(error).toBe('Must be one of: option1, option2, option3');
      });

      it('should reject non-string enum value', () => {
        expect(validateVariableValue(schema, 123)).toBe('Must be a string');
        expect(validateVariableValue(schema, true)).toBe('Must be a string');
      });

      it('should error when enumValues is undefined', () => {
        const invalidSchema: VariableSchema = {
          name: 'test_enum',
          type: 'enum',
          // Missing enumValues
        };

        expect(validateVariableValue(invalidSchema, 'option1')).toBe(
          'Enum type requires enumValues to be defined'
        );
      });

      it('should error when enumValues is empty array', () => {
        const invalidSchema: VariableSchema = {
          name: 'test_enum',
          type: 'enum',
          enumValues: [],
        };

        expect(validateVariableValue(invalidSchema, 'option1')).toBe(
          'Enum type requires enumValues to be defined'
        );
      });
    });

    describe('Unknown Type', () => {
      it('should error for unknown variable type', () => {
        const invalidSchema = {
          name: 'test_unknown',
          type: 'unknown_type' as 'string' | 'number' | 'boolean' | 'enum',
        };

        expect(validateVariableValue(invalidSchema, 'value')).toBe(
          'Unknown variable type: unknown_type'
        );
      });
    });
  });

  describe('validateAllVariables', () => {
    const schemas: VariableSchema[] = [
      { name: 'population', type: 'number' },
      { name: 'mayor_name', type: 'string' },
      { name: 'has_walls', type: 'boolean' },
      { name: 'climate', type: 'enum', enumValues: ['temperate', 'tropical', 'arctic'] },
    ];

    it('should return empty object when all values are valid', () => {
      const values = {
        population: 1000,
        mayor_name: 'Lord Blackwood',
        has_walls: true,
        climate: 'temperate',
      };

      const errors = validateAllVariables(schemas, values);
      expect(errors).toEqual({});
    });

    it('should return errors for all invalid fields', () => {
      const values = {
        population: 'not a number',
        mayor_name: 123, // Invalid string
        has_walls: 'yes', // Invalid boolean
        climate: 'invalid', // Invalid enum
      };

      const errors = validateAllVariables(schemas, values);
      expect(errors).toEqual({
        population: 'Must be a valid number',
        mayor_name: 'Must be text',
        has_walls: 'Must be true or false',
        climate: 'Must be one of: temperate, tropical, arctic',
      });
    });

    it('should return errors for some invalid fields', () => {
      const values = {
        population: 'invalid',
        mayor_name: 'Lord Blackwood',
        has_walls: true,
        climate: 'temperate',
      };

      const errors = validateAllVariables(schemas, values);
      expect(errors).toEqual({
        population: 'Must be a valid number',
      });
    });

    it('should allow empty/null/undefined values', () => {
      const values = {
        population: null,
        mayor_name: '',
        has_walls: undefined,
        climate: '',
      };

      const errors = validateAllVariables(schemas, values);
      expect(errors).toEqual({});
    });

    it('should handle missing values gracefully', () => {
      const values = {}; // No values provided

      const errors = validateAllVariables(schemas, values);
      expect(errors).toEqual({});
    });

    it('should handle empty schemas array', () => {
      const errors = validateAllVariables([], { some_field: 'value' });
      expect(errors).toEqual({});
    });
  });

  describe('convertFormValues', () => {
    const schemas: VariableSchema[] = [
      { name: 'population', type: 'number' },
      { name: 'mayor_name', type: 'string' },
      { name: 'has_walls', type: 'boolean' },
      { name: 'climate', type: 'enum', enumValues: ['temperate', 'tropical'] },
    ];

    describe('String Conversion', () => {
      it('should convert string values', () => {
        const values = { mayor_name: 'Lord Blackwood' };
        const converted = convertFormValues(schemas, values);
        expect(converted.mayor_name).toBe('Lord Blackwood');
      });

      it('should convert non-string to string', () => {
        const values = { mayor_name: 123 };
        const converted = convertFormValues(schemas, values);
        expect(converted.mayor_name).toBe('123');
      });

      it('should skip empty string and use default', () => {
        const schemasWithDefault: VariableSchema[] = [
          { name: 'mayor_name', type: 'string', defaultValue: 'Unknown' },
        ];
        const values = { mayor_name: '' };
        const converted = convertFormValues(schemasWithDefault, values);
        expect(converted.mayor_name).toBe('Unknown');
      });
    });

    describe('Number Conversion', () => {
      it('should keep number values as numbers', () => {
        const values = { population: 1000 };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBe(1000);
      });

      it('should convert string to number', () => {
        const values = { population: '1000' };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBe(1000);
      });

      it('should convert decimal string to number', () => {
        const values = { population: '3.14' };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBe(3.14);
      });

      it('should skip invalid number strings', () => {
        const values = { population: 'not a number' };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBeUndefined();
      });

      it('should skip empty string and use default', () => {
        const schemasWithDefault: VariableSchema[] = [
          { name: 'population', type: 'number', defaultValue: 100 },
        ];
        const values = { population: '' };
        const converted = convertFormValues(schemasWithDefault, values);
        expect(converted.population).toBe(100);
      });

      it('should skip null and use default', () => {
        const schemasWithDefault: VariableSchema[] = [
          { name: 'population', type: 'number', defaultValue: 100 },
        ];
        const values = { population: null };
        const converted = convertFormValues(schemasWithDefault, values);
        expect(converted.population).toBe(100);
      });
    });

    describe('Boolean Conversion', () => {
      it('should keep boolean values as booleans', () => {
        const values = { has_walls: true };
        const converted = convertFormValues(schemas, values);
        expect(converted.has_walls).toBe(true);
      });

      it('should convert string "true" to boolean true', () => {
        const values = { has_walls: 'true' };
        const converted = convertFormValues(schemas, values);
        expect(converted.has_walls).toBe(true);
      });

      it('should convert string "false" to boolean false', () => {
        const values = { has_walls: 'false' };
        const converted = convertFormValues(schemas, values);
        expect(converted.has_walls).toBe(false);
      });

      it('should convert other strings to false', () => {
        const values = { has_walls: 'yes' };
        const converted = convertFormValues(schemas, values);
        expect(converted.has_walls).toBe(false);
      });

      it('should skip empty string and use default', () => {
        const schemasWithDefault: VariableSchema[] = [
          { name: 'has_walls', type: 'boolean', defaultValue: false },
        ];
        const values = { has_walls: '' };
        const converted = convertFormValues(schemasWithDefault, values);
        expect(converted.has_walls).toBe(false);
      });
    });

    describe('Enum Conversion', () => {
      it('should convert enum values to strings', () => {
        const values = { climate: 'temperate' };
        const converted = convertFormValues(schemas, values);
        expect(converted.climate).toBe('temperate');
      });

      it('should convert non-string enum to string', () => {
        const values = { climate: 123 };
        const converted = convertFormValues(schemas, values);
        expect(converted.climate).toBe('123');
      });

      it('should skip empty string and use default', () => {
        const schemasWithDefault: VariableSchema[] = [
          {
            name: 'climate',
            type: 'enum',
            enumValues: ['temperate', 'tropical'],
            defaultValue: 'temperate',
          },
        ];
        const values = { climate: '' };
        const converted = convertFormValues(schemasWithDefault, values);
        expect(converted.climate).toBe('temperate');
      });
    });

    describe('Null/Undefined/Empty Handling', () => {
      it('should skip null values', () => {
        const values = { population: null };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBeUndefined();
      });

      it('should skip undefined values', () => {
        const values = { population: undefined };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBeUndefined();
      });

      it('should skip empty string values', () => {
        const values = { mayor_name: '' };
        const converted = convertFormValues(schemas, values);
        expect(converted.mayor_name).toBeUndefined();
      });

      it('should use default values when provided', () => {
        const schemasWithDefaults: VariableSchema[] = [
          { name: 'population', type: 'number', defaultValue: 100 },
          { name: 'mayor_name', type: 'string', defaultValue: 'Unknown' },
          { name: 'has_walls', type: 'boolean', defaultValue: false },
          { name: 'climate', type: 'enum', enumValues: ['temperate'], defaultValue: 'temperate' },
        ];

        const values = {
          population: '',
          mayor_name: null,
          has_walls: undefined,
          climate: '',
        };

        const converted = convertFormValues(schemasWithDefaults, values);
        expect(converted).toEqual({
          population: 100,
          mayor_name: 'Unknown',
          has_walls: false,
          climate: 'temperate',
        });
      });
    });

    describe('Multiple Fields', () => {
      it('should convert all fields correctly', () => {
        const values = {
          population: '1500',
          mayor_name: 'Lord Blackwood',
          has_walls: 'true',
          climate: 'tropical',
        };

        const converted = convertFormValues(schemas, values);
        expect(converted).toEqual({
          population: 1500,
          mayor_name: 'Lord Blackwood',
          has_walls: true,
          climate: 'tropical',
        });
      });

      it('should handle partial values', () => {
        const values = {
          population: '1500',
          mayor_name: 'Lord Blackwood',
          // has_walls and climate missing
        };

        const converted = convertFormValues(schemas, values);
        expect(converted).toEqual({
          population: 1500,
          mayor_name: 'Lord Blackwood',
        });
      });

      it('should handle empty values object', () => {
        const converted = convertFormValues(schemas, {});
        expect(converted).toEqual({});
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty schemas array', () => {
        const values = { some_field: 'value' };
        const converted = convertFormValues([], values);
        expect(converted).toEqual({});
      });

      it('should handle values not in schemas', () => {
        const values = {
          population: '1500',
          extra_field: 'should be ignored',
        };

        const converted = convertFormValues(schemas, values);
        expect(converted).toEqual({
          population: 1500,
        });
        expect(converted.extra_field).toBeUndefined();
      });

      it('should handle zero values', () => {
        const values = { population: 0 };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBe(0);
      });

      it('should handle negative numbers', () => {
        const values = { population: '-100' };
        const converted = convertFormValues(schemas, values);
        expect(converted.population).toBe(-100);
      });
    });
  });
});
