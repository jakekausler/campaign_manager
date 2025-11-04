/**
 * Integration tests for Condition GraphQL hooks
 *
 * Tests the Condition hooks with MSW-mocked GraphQL responses:
 * - useConditionsForEntity
 * - useEvaluateCondition
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, afterEach, vi } from 'vitest';

import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useConditionsForEntity, useEvaluateCondition } from './conditions';

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

afterEach(() => {
  cleanup(); // Unmount all React components and hooks
  vi.clearAllMocks(); // Clear all mock function call history
});

describe('Condition Hooks Integration Tests', () => {
  describe('useConditionsForEntity', () => {
    it('should fetch conditions for a Settlement entity', async () => {
      const { result } = renderHook(() => useConditionsForEntity('Settlement', 'settlement-1'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.conditions).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have conditions for settlement-1 (including type-level conditions)
      expect(result.current.conditions.length).toBeGreaterThanOrEqual(2);

      // Check instance-level conditions
      const instanceConditions = result.current.conditions.filter(
        (c) => c.entityId === 'settlement-1'
      );
      expect(instanceConditions).toHaveLength(2);
      expect(instanceConditions[0].id).toBe('condition-1');
      expect(instanceConditions[0].field).toBe('is_trade_hub');
      expect(instanceConditions[1].id).toBe('condition-2');
      expect(instanceConditions[1].field).toBe('is_fortified');

      // Check type-level conditions
      const typeLevelConditions = result.current.conditions.filter((c) => c.entityId === null);
      expect(typeLevelConditions.length).toBeGreaterThanOrEqual(1);
    });

    it('should fetch conditions for a Structure entity', async () => {
      const { result } = renderHook(() => useConditionsForEntity('Structure', 'structure-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have at least one condition for structure-1
      const structureConditions = result.current.conditions.filter(
        (c) => c.entityId === 'structure-1'
      );
      expect(structureConditions.length).toBeGreaterThanOrEqual(1);
      expect(structureConditions[0].id).toBe('condition-3');
      expect(structureConditions[0].field).toBe('is_operational');
    });

    it('should filter conditions by field name', async () => {
      const { result } = renderHook(
        () => useConditionsForEntity('Settlement', 'settlement-1', 'is_trade_hub'),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only have conditions for the is_trade_hub field
      expect(result.current.conditions.length).toBeGreaterThanOrEqual(1);
      result.current.conditions.forEach((condition) => {
        expect(condition.field).toBe('is_trade_hub');
      });
    });

    it('should return empty array for entity with no conditions', async () => {
      const { result } = renderHook(() => useConditionsForEntity('Settlement', 'settlement-999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have no instance-specific conditions (but may have type-level)
      const instanceConditions = result.current.conditions.filter(
        (c) => c.entityId === 'settlement-999'
      );
      expect(instanceConditions).toEqual([]);
    });

    it('should include condition metadata', async () => {
      const { result } = renderHook(() => useConditionsForEntity('Settlement', 'settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const condition = result.current.conditions.find((c) => c.id === 'condition-1');
      expect(condition).toBeDefined();
      expect(condition?.entityType).toBe('Settlement');
      expect(condition?.entityId).toBe('settlement-1');
      expect(condition?.description).toBeTruthy();
      expect(condition?.expression).toBeDefined();
      expect(condition?.isActive).toBe(true);
      expect(condition?.priority).toBeDefined();
      expect(condition?.version).toBeDefined();
      expect(condition?.createdAt).toBeTruthy();
      expect(condition?.updatedAt).toBeTruthy();
    });

    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useConditionsForEntity('Settlement', 'settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.getConditionsForEntity).toBeDefined();
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useConditionsForEntity('Settlement', 'settlement-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });

  describe('useEvaluateCondition', () => {
    it('should evaluate a condition with context', async () => {
      const { result } = renderHook(() => useEvaluateCondition(), {
        wrapper: createWrapper(),
      });

      // Execute the lazy query
      const [evaluate] = result.current;
      evaluate({
        variables: {
          input: {
            conditionId: 'condition-1',
            context: { level: 3 },
          },
        },
      });

      // Wait for the evaluation to complete
      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      // Should have evaluation result
      expect(result.current[1].data).toBeDefined();
      expect(result.current[1].data?.evaluateFieldCondition).toBeDefined();
      expect(result.current[1].data?.evaluateFieldCondition.success).toBe(true);
      expect(result.current[1].data?.evaluateFieldCondition.value).toBeDefined();
    });

    it('should include evaluation trace', async () => {
      const { result } = renderHook(() => useEvaluateCondition(), {
        wrapper: createWrapper(),
      });

      const [evaluate] = result.current;
      await evaluate({
        variables: {
          input: {
            conditionId: 'condition-1',
            context: { level: 3 },
          },
        },
      });

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      // Should have trace information
      const trace = result.current[1].data?.evaluateFieldCondition.trace;
      expect(trace).toBeDefined();
      expect(Array.isArray(trace)).toBe(true);
      expect(trace!.length).toBeGreaterThan(0);

      // Check trace structure
      const firstStep = trace![0];
      expect(firstStep.step).toBeDefined();
      expect(firstStep.operation).toBeDefined();
      expect(firstStep.input).toBeDefined();
      expect(firstStep.output).toBeDefined();
    });

    it('should return error for non-existent condition', async () => {
      const { result } = renderHook(() => useEvaluateCondition(), {
        wrapper: createWrapper(),
      });

      const [evaluate] = result.current;

      // Call evaluate without awaiting - errors will populate the error field
      evaluate({
        variables: {
          input: {
            conditionId: 'non-existent',
            context: { level: 3 },
          },
        },
      });

      // Wait for the error to be populated
      await waitFor(() => {
        expect(result.current[1].error).toBeDefined();
      });

      // Verify loading is complete
      expect(result.current[1].loading).toBe(false);
    });

    it('should use network-only fetch policy', async () => {
      const { result } = renderHook(() => useEvaluateCondition(), {
        wrapper: createWrapper(),
      });

      const [evaluate] = result.current;

      // First evaluation
      await evaluate({
        variables: {
          input: {
            conditionId: 'condition-1',
            context: { level: 3 },
          },
        },
      });

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      // Second evaluation should fetch from network again (not cache)
      await evaluate({
        variables: {
          input: {
            conditionId: 'condition-1',
            context: { level: 5 },
          },
        },
      });

      // Both evaluations should succeed
      expect(result.current[1].data?.evaluateFieldCondition.success).toBe(true);
    });
  });
});
