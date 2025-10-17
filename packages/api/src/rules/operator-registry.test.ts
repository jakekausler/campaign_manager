/**
 * Operator Registry Tests
 */

import { OperatorRegistry } from './operator-registry';
import type { CustomOperator } from './types/expression.types';

describe('OperatorRegistry', () => {
  let registry: OperatorRegistry;

  beforeEach(() => {
    registry = new OperatorRegistry();
  });

  describe('register', () => {
    it('should register a custom operator', () => {
      const operator: CustomOperator = {
        name: 'double',
        implementation: (...args: unknown[]) => (args[0] as number) * 2,
        description: 'Doubles a number',
      };

      registry.register(operator);

      expect(registry.has('double')).toBe(true);
    });

    it('should register multiple operators', () => {
      const op1: CustomOperator = {
        name: 'add10',
        implementation: (...args: unknown[]) => (args[0] as number) + 10,
      };
      const op2: CustomOperator = {
        name: 'multiply5',
        implementation: (...args: unknown[]) => (args[0] as number) * 5,
      };

      registry.register(op1);
      registry.register(op2);

      expect(registry.has('add10')).toBe(true);
      expect(registry.has('multiply5')).toBe(true);
    });

    it('should throw error when registering duplicate operator name', () => {
      const op1: CustomOperator = {
        name: 'test',
        implementation: () => 1,
      };
      const op2: CustomOperator = {
        name: 'test',
        implementation: () => 2,
      };

      registry.register(op1);

      expect(() => registry.register(op2)).toThrow('Operator "test" is already registered');
    });

    it('should throw error when operator name is empty', () => {
      const operator: CustomOperator = {
        name: '',
        implementation: () => 1,
      };

      expect(() => registry.register(operator)).toThrow('Operator name cannot be empty');
    });
  });

  describe('has', () => {
    it('should return true for registered operator', () => {
      const operator: CustomOperator = {
        name: 'exists',
        implementation: () => true,
      };

      registry.register(operator);

      expect(registry.has('exists')).toBe(true);
    });

    it('should return false for unregistered operator', () => {
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return registered operator', () => {
      const operator: CustomOperator = {
        name: 'test',
        implementation: (...args: unknown[]) => (args[0] as number) + 1,
        description: 'Test operator',
      };

      registry.register(operator);
      const retrieved = registry.get('test');

      expect(retrieved).toEqual(operator);
    });

    it('should return undefined for unregistered operator', () => {
      const retrieved = registry.get('nonexistent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered operators', () => {
      const op1: CustomOperator = {
        name: 'op1',
        implementation: () => 1,
      };
      const op2: CustomOperator = {
        name: 'op2',
        implementation: () => 2,
      };

      registry.register(op1);
      registry.register(op2);

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContainEqual(op1);
      expect(all).toContainEqual(op2);
    });

    it('should return empty array when no operators registered', () => {
      const all = registry.getAll();

      expect(all).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('should remove a registered operator', () => {
      const operator: CustomOperator = {
        name: 'remove',
        implementation: () => 1,
      };

      registry.register(operator);
      expect(registry.has('remove')).toBe(true);

      registry.unregister('remove');

      expect(registry.has('remove')).toBe(false);
    });

    it('should not throw error when unregistering nonexistent operator', () => {
      expect(() => registry.unregister('nonexistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all registered operators', () => {
      const op1: CustomOperator = {
        name: 'op1',
        implementation: () => 1,
      };
      const op2: CustomOperator = {
        name: 'op2',
        implementation: () => 2,
      };

      registry.register(op1);
      registry.register(op2);
      expect(registry.getAll()).toHaveLength(2);

      registry.clear();

      expect(registry.getAll()).toHaveLength(0);
      expect(registry.has('op1')).toBe(false);
      expect(registry.has('op2')).toBe(false);
    });
  });

  describe('getOperatorMap', () => {
    it('should return map of operator names to functions', () => {
      const op1: CustomOperator = {
        name: 'add5',
        implementation: (...args: unknown[]) => (args[0] as number) + 5,
      };
      const op2: CustomOperator = {
        name: 'multiply2',
        implementation: (...args: unknown[]) => (args[0] as number) * 2,
      };

      registry.register(op1);
      registry.register(op2);

      const map = registry.getOperatorMap();

      expect(map).toHaveProperty('add5');
      expect(map).toHaveProperty('multiply2');
      expect(map.add5(10)).toBe(15);
      expect(map.multiply2(10)).toBe(20);
    });

    it('should return empty object when no operators registered', () => {
      const map = registry.getOperatorMap();

      expect(map).toEqual({});
    });
  });
});
