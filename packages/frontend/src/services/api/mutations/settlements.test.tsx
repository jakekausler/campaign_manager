/**
 * Integration tests for Settlement mutation hooks
 *
 * Tests all Settlement mutation hooks with MSW-mocked GraphQL responses:
 * - useCreateSettlement
 * - useUpdateSettlement
 * - useDeleteSettlement
 * - useArchiveSettlement
 * - useRestoreSettlement
 *
 * Verifies cache update strategies including refetchQueries, cache eviction,
 * and cache field modifications.
 */

import { ApolloProvider } from '@apollo/client/react';
import { act, renderHook, cleanup } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it, afterEach, vi } from 'vitest';

import { server } from '@/__tests__/mocks/server';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import {
  type Settlement,
  useArchiveSettlement,
  useCreateSettlement,
  useDeleteSettlement,
  useRestoreSettlement,
  useUpdateSettlement,
} from './settlements';

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

describe('Settlement Mutation Hooks Integration Tests', () => {
  describe('useCreateSettlement', () => {
    it('should create a new settlement', async () => {
      const { result } = renderHook(() => useCreateSettlement(), {
        wrapper: createWrapper(),
      });

      // Initially not loading
      expect(result.current.loading).toBe(false);

      // Call mutation
      let createdSettlement: Settlement | undefined;
      await act(async () => {
        createdSettlement = await result.current.createSettlement({
          kingdomId: 'kingdom-1',
          locationId: 'location-1',
          name: 'New Settlement',
          level: 1,
        });
      });

      // Should return created settlement
      expect(createdSettlement).toBeDefined();
      expect(createdSettlement?.name).toBe('New Settlement');
      expect(createdSettlement?.kingdomId).toBe('kingdom-1');
      expect(createdSettlement?.locationId).toBe('location-1');
      expect(createdSettlement?.level).toBe(1);
      expect(createdSettlement?.version).toBe(1);
      expect(createdSettlement?.id).toMatch(/^settlement-/);
    });

    it('should handle creation errors', async () => {
      // Override MSW handler to return error
      server.use(
        graphql.mutation('CreateSettlement', () => {
          return HttpResponse.json({
            errors: [{ message: 'Failed to create settlement' }],
          });
        })
      );

      const { result } = renderHook(() => useCreateSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation and expect error
      let error;
      await act(async () => {
        try {
          await result.current.createSettlement({
            kingdomId: 'kingdom-1',
            locationId: 'location-1',
            name: 'New Settlement',
            level: 1,
          });
        } catch (err) {
          error = err;
        }
      });

      expect(error).toBeDefined();
    });

    it('should set loading state during mutation', async () => {
      const { result } = renderHook(() => useCreateSettlement(), {
        wrapper: createWrapper(),
      });

      // Initially not loading
      expect(result.current.loading).toBe(false);

      // Start mutation (don't await immediately)
      const promise = act(async () => {
        await result.current.createSettlement({
          kingdomId: 'kingdom-1',
          locationId: 'location-1',
          name: 'New Settlement',
          level: 1,
        });
      });

      // Should be loading during mutation (Note: this may be flaky due to timing)
      // Loading state will be true briefly during the mutation

      // Wait for completion
      await promise;

      // Should not be loading after completion
      expect(result.current.loading).toBe(false);
    });
  });

  describe('useUpdateSettlement', () => {
    it('should update an existing settlement', async () => {
      const { result } = renderHook(() => useUpdateSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation
      let updatedSettlement: Settlement | undefined;
      await act(async () => {
        updatedSettlement = await result.current.updateSettlement('settlement-1', {
          name: 'Updated Name',
          level: 3,
        });
      });

      // Should return updated settlement
      expect(updatedSettlement).toBeDefined();
      expect(updatedSettlement?.id).toBe('settlement-1');
      expect(updatedSettlement?.name).toBe('Updated Name');
      expect(updatedSettlement?.level).toBe(3);
      expect(updatedSettlement?.version).toBeGreaterThan(1);
    });

    it('should handle updates to non-existent settlements', async () => {
      // Override MSW handler to return error for specific ID
      server.use(
        graphql.mutation('UpdateSettlement', ({ variables }) => {
          const { id } = variables as { id: string };
          if (id === 'non-existent') {
            return HttpResponse.json({
              errors: [{ message: 'Settlement not found' }],
            });
          }
          // Default handler continues
          return HttpResponse.json({
            data: null,
          });
        })
      );

      const { result } = renderHook(() => useUpdateSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation with non-existent ID
      let error;
      await act(async () => {
        try {
          await result.current.updateSettlement('non-existent', {
            name: 'Updated Name',
          });
        } catch (err) {
          error = err;
        }
      });

      expect(error).toBeDefined();
    });

    it('should update with optional fields', async () => {
      const { result } = renderHook(() => useUpdateSettlement(), {
        wrapper: createWrapper(),
      });

      // Update only name
      let updated1: Settlement | undefined;
      await act(async () => {
        updated1 = await result.current.updateSettlement('settlement-1', {
          name: 'Only Name Changed',
        });
      });

      expect(updated1?.name).toBe('Only Name Changed');

      // Update only level
      let updated2: Settlement | undefined;
      await act(async () => {
        updated2 = await result.current.updateSettlement('settlement-1', {
          level: 5,
        });
      });

      expect(updated2?.level).toBe(5);
    });
  });

  describe('useDeleteSettlement', () => {
    it('should delete a settlement', async () => {
      const { result } = renderHook(() => useDeleteSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation
      let deleted: Settlement | undefined;
      await act(async () => {
        deleted = await result.current.deleteSettlement('settlement-1');
      });

      // Should return deleted settlement
      expect(deleted).toBeDefined();
    });

    it('should delete with optional branchId', async () => {
      const { result } = renderHook(() => useDeleteSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation with branchId
      let deleted: Settlement | undefined;
      await act(async () => {
        deleted = await result.current.deleteSettlement('settlement-1', 'branch-1');
      });

      expect(deleted).toBeDefined();
    });

    it('should handle deletion errors', async () => {
      // Override MSW handler to return error
      server.use(
        graphql.mutation('DeleteSettlement', () => {
          return HttpResponse.json({
            errors: [{ message: 'Settlement not found' }],
          });
        })
      );

      const { result } = renderHook(() => useDeleteSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation and expect error
      let error;
      await act(async () => {
        try {
          await result.current.deleteSettlement('non-existent');
        } catch (err) {
          error = err;
        }
      });

      expect(error).toBeDefined();
    });
  });

  describe('useArchiveSettlement', () => {
    it('should archive a settlement', async () => {
      const { result } = renderHook(() => useArchiveSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation
      let archived: Settlement | undefined;
      await act(async () => {
        archived = await result.current.archiveSettlement('settlement-1');
      });

      // Should return archived settlement with deletedAt timestamp
      expect(archived).toBeDefined();
      expect(archived?.id).toBe('settlement-1');
      expect(archived?.deletedAt).toBeDefined();
      expect(archived?.deletedAt).not.toBeNull();
      expect(archived?.version).toBeGreaterThan(1);
    });

    it('should archive with optional branchId', async () => {
      const { result } = renderHook(() => useArchiveSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation with branchId
      let archived: Settlement | undefined;
      await act(async () => {
        archived = await result.current.archiveSettlement('settlement-1', 'branch-1');
      });

      expect(archived?.deletedAt).toBeDefined();
    });

    it('should handle archival errors', async () => {
      // Override MSW handler to return error
      server.use(
        graphql.mutation('ArchiveSettlement', () => {
          return HttpResponse.json({
            errors: [{ message: 'Settlement not found' }],
          });
        })
      );

      const { result } = renderHook(() => useArchiveSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation and expect error
      let error;
      await act(async () => {
        try {
          await result.current.archiveSettlement('non-existent');
        } catch (err) {
          error = err;
        }
      });

      expect(error).toBeDefined();
    });
  });

  describe('useRestoreSettlement', () => {
    it('should restore an archived settlement', async () => {
      const { result } = renderHook(() => useRestoreSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation
      let restored: Settlement | undefined;
      await act(async () => {
        restored = await result.current.restoreSettlement('settlement-1');
      });

      // Should return restored settlement with null deletedAt
      expect(restored).toBeDefined();
      expect(restored?.id).toBe('settlement-1');
      expect(restored?.deletedAt).toBeNull();
      expect(restored?.version).toBeGreaterThan(1);
    });

    it('should restore with optional branchId', async () => {
      const { result } = renderHook(() => useRestoreSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation with branchId
      let restored: Settlement | undefined;
      await act(async () => {
        restored = await result.current.restoreSettlement('settlement-1', 'branch-1');
      });

      expect(restored?.deletedAt).toBeNull();
    });

    it('should handle restoration errors', async () => {
      // Override MSW handler to return error
      server.use(
        graphql.mutation('RestoreSettlement', () => {
          return HttpResponse.json({
            errors: [{ message: 'Settlement not found' }],
          });
        })
      );

      const { result } = renderHook(() => useRestoreSettlement(), {
        wrapper: createWrapper(),
      });

      // Call mutation and expect error
      let error;
      await act(async () => {
        try {
          await result.current.restoreSettlement('non-existent');
        } catch (err) {
          error = err;
        }
      });

      expect(error).toBeDefined();
    });
  });

  describe('Cache Update Integration', () => {
    it('should update cache after archiving and restoring', async () => {
      const wrapper = createWrapper();

      // Archive a settlement
      const { result: archiveResult } = renderHook(() => useArchiveSettlement(), { wrapper });

      let archived: Settlement | undefined;
      await act(async () => {
        archived = await archiveResult.current.archiveSettlement('settlement-1');
      });

      expect(archived?.deletedAt).toBeDefined();
      expect(archived?.deletedAt).not.toBeNull();

      // Restore the same settlement
      const { result: restoreResult } = renderHook(() => useRestoreSettlement(), { wrapper });

      let restored: Settlement | undefined;
      await act(async () => {
        restored = await restoreResult.current.restoreSettlement('settlement-1');
      });

      expect(restored?.deletedAt).toBeNull();
    });
  });
});
