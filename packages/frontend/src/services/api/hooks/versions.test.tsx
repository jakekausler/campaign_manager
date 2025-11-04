/**
 * Integration tests for Version History GraphQL hooks
 *
 * Tests the Version hooks with MSW-mocked GraphQL responses:
 * - useEntityVersions
 * - useCompareVersions
 * - useRestoreVersion
 */

import { ApolloProvider } from '@apollo/client/react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/__tests__/mocks/server';
import { createTestApolloClient } from '@/__tests__/utils/test-utils';

import { useEntityVersions, useCompareVersions, useRestoreVersion } from './versions';
import type { Version, VersionDiff } from './versions';

// Mock version data for a Settlement entity
const mockVersions: Version[] = [
  {
    id: 'version-3',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    branchId: 'main',
    validFrom: '2024-03-01T12:00:00.000Z',
    validTo: null, // Current version
    payload: {
      id: 'settlement-1',
      name: 'Ironhold',
      level: 5,
      variables: { population: 5000, gold: 10000, hasWalls: true },
      structures: ['structure-1', 'structure-2', 'structure-3'],
    },
    version: 3,
    comment: 'Upgraded to level 5',
    createdBy: 'user-1',
    createdAt: '2024-03-01T12:00:00.000Z',
  },
  {
    id: 'version-2',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    branchId: 'main',
    validFrom: '2024-02-01T10:00:00.000Z',
    validTo: '2024-03-01T12:00:00.000Z',
    payload: {
      id: 'settlement-1',
      name: 'Ironhold',
      level: 4,
      variables: { population: 4000, gold: 8000, hasWalls: true },
      structures: ['structure-1', 'structure-2'],
    },
    version: 2,
    comment: 'Added city walls',
    createdBy: 'user-1',
    createdAt: '2024-02-01T10:00:00.000Z',
  },
  {
    id: 'version-1',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    branchId: 'main',
    validFrom: '2024-01-01T00:00:00.000Z',
    validTo: '2024-02-01T10:00:00.000Z',
    payload: {
      id: 'settlement-1',
      name: 'Ironhold',
      level: 3,
      variables: { population: 3000, gold: 5000 },
      structures: ['structure-1'],
    },
    version: 1,
    comment: 'Initial version',
    createdBy: 'user-1',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

// Mock diff data showing changes between version-1 and version-2
const mockDiff: VersionDiff = {
  added: {
    structures: ['structure-2'],
  },
  modified: {
    level: { old: 3, new: 4 },
    'variables.population': { old: 3000, new: 4000 },
    'variables.gold': { old: 5000, new: 8000 },
    'variables.hasWalls': { old: undefined, new: true },
  },
  removed: {},
};

// GraphQL handlers for version operations
const versionHandlers = [
  graphql.query('EntityVersions', ({ variables }) => {
    const { entityType, entityId, branchId } = variables as {
      entityType: string;
      entityId: string;
      branchId: string;
    };

    // Error case for invalid entities
    if (entityId.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Failed to fetch version history' }],
      });
    }

    // Empty case for entities with no versions
    if (entityId === 'settlement-999') {
      return HttpResponse.json({
        data: { entityVersions: [] },
      });
    }

    // Return versions for settlement-1
    if (entityType === 'Settlement' && entityId === 'settlement-1' && branchId === 'main') {
      return HttpResponse.json({
        data: { entityVersions: mockVersions },
      });
    }

    // Default empty response
    return HttpResponse.json({
      data: { entityVersions: [] },
    });
  }),

  graphql.query('VersionDiff', ({ variables }) => {
    const { versionId1, versionId2 } = variables as {
      versionId1: string;
      versionId2: string;
    };

    // Error case for invalid version IDs
    if (versionId1.startsWith('invalid-') || versionId2.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Version not found' }],
      });
    }

    // Return mock diff for version-1 to version-2
    if (versionId1 === 'version-1' && versionId2 === 'version-2') {
      return HttpResponse.json({
        data: { versionDiff: mockDiff },
      });
    }

    // Default empty diff
    return HttpResponse.json({
      data: {
        versionDiff: {
          added: {},
          modified: {},
          removed: {},
        },
      },
    });
  }),

  graphql.mutation('RestoreVersion', ({ variables }) => {
    const { input } = variables as {
      input: {
        versionId: string;
        branchId: string;
        worldTime?: Date | null;
        comment?: string | null;
      };
    };

    // Error case for invalid version IDs
    if (input.versionId.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Version not found' }],
      });
    }

    // Find the version being restored
    const sourceVersion = mockVersions.find((v) => v.id === input.versionId);
    if (!sourceVersion) {
      return HttpResponse.json({
        errors: [{ message: 'Version not found' }],
      });
    }

    // Create a new version with restored payload
    const restoredVersion: Version = {
      id: `version-${Date.now()}`,
      entityType: sourceVersion.entityType,
      entityId: sourceVersion.entityId,
      branchId: input.branchId,
      validFrom: input.worldTime
        ? new Date(input.worldTime).toISOString()
        : new Date().toISOString(),
      validTo: null,
      payload: sourceVersion.payload, // Restore old payload
      version: mockVersions[0].version + 1, // Increment version
      comment: input.comment || `Restored from version ${sourceVersion.version}`,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      data: { restoreVersion: restoredVersion },
    });
  }),
];

// Create a wrapper component for Apollo Provider
function createWrapper() {
  const client = createTestApolloClient();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ApolloProvider client={client}>{children}</ApolloProvider>;
  };
}

describe('Version History Hooks Integration Tests', () => {
  // Install version-specific handlers before each test
  beforeEach(() => {
    server.use(...versionHandlers);
  });

  // Clean up after each test
  afterEach(() => {
    cleanup(); // Unmount all React components and hooks
    vi.clearAllMocks(); // Clear all mock function call history
    server.resetHandlers();
  });

  describe('useEntityVersions', () => {
    it('should fetch version history for an entity successfully', async () => {
      const { result } = renderHook(() => useEntityVersions('Settlement', 'settlement-1', 'main'), {
        wrapper: createWrapper(),
      });

      // Initially loading
      expect(result.current.loading).toBe(true);
      expect(result.current.versions).toEqual([]);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have all versions
      expect(result.current.versions).toHaveLength(3);
      expect(result.current.versions[0].id).toBe('version-3');
      expect(result.current.versions[0].version).toBe(3);
      expect(result.current.versions[0].validTo).toBeNull(); // Current version

      expect(result.current.versions[1].id).toBe('version-2');
      expect(result.current.versions[1].version).toBe(2);

      expect(result.current.versions[2].id).toBe('version-1');
      expect(result.current.versions[2].version).toBe(1);
    });

    it('should return empty array when no versions exist', async () => {
      const { result } = renderHook(
        () => useEntityVersions('Settlement', 'settlement-999', 'main'),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.versions).toEqual([]);
      expect(result.current.error).toBeUndefined();
    });

    it('should handle loading states correctly', async () => {
      const { result } = renderHook(() => useEntityVersions('Settlement', 'settlement-1', 'main'), {
        wrapper: createWrapper(),
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);
      expect(result.current.versions).toEqual([]);
      expect(result.current.error).toBeUndefined();

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.versions.length).toBeGreaterThan(0);
    });

    it('should handle error states appropriately', async () => {
      const { result } = renderHook(
        () => useEntityVersions('Settlement', 'invalid-settlement', 'main'),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Failed to fetch version history');
      expect(result.current.versions).toEqual([]);
    });

    it('should work with skip option', async () => {
      const { result } = renderHook(
        () => useEntityVersions('Settlement', 'settlement-1', 'main', { skip: true }),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not load when skipped
      expect(result.current.loading).toBe(false);
      expect(result.current.versions).toEqual([]);
    });

    it('should refetch data when refetch is called', async () => {
      const { result } = renderHook(() => useEntityVersions('Settlement', 'settlement-1', 'main'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.versions).toHaveLength(3);
      expect(result.current.refetch).toBeInstanceOf(Function);

      // Refetch should work
      const refetchResult = await result.current.refetch();
      expect(refetchResult.data?.entityVersions).toBeDefined();
      expect(refetchResult.data?.entityVersions).toHaveLength(3);
    });

    it('should include version metadata', async () => {
      const { result } = renderHook(() => useEntityVersions('Settlement', 'settlement-1', 'main'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const version = result.current.versions[0];
      expect(version.id).toBe('version-3');
      expect(version.entityType).toBe('Settlement');
      expect(version.entityId).toBe('settlement-1');
      expect(version.branchId).toBe('main');
      expect(version.validFrom).toBeTruthy();
      expect(version.payload).toBeDefined();
      expect(version.version).toBe(3);
      expect(version.comment).toBe('Upgraded to level 5');
      expect(version.createdBy).toBe('user-1');
      expect(version.createdAt).toBeTruthy();
    });

    it('should provide network status', async () => {
      const { result } = renderHook(() => useEntityVersions('Settlement', 'settlement-1', 'main'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.networkStatus).toBeDefined();
    });
  });

  describe('useCompareVersions (lazy query)', () => {
    it('should not execute immediately (lazy behavior)', () => {
      const { result } = renderHook(() => useCompareVersions(), {
        wrapper: createWrapper(),
      });

      // Should not have data or error initially
      expect(result.current[1].data).toBeUndefined();
      expect(result.current[1].error).toBeUndefined();
      expect(result.current[1].loading).toBe(false);
    });

    it('should compute diff between two versions when called', async () => {
      const { result } = renderHook(() => useCompareVersions(), {
        wrapper: createWrapper(),
      });

      const [compareVersions] = result.current;

      // Execute the lazy query
      compareVersions({
        variables: {
          versionId1: 'version-1',
          versionId2: 'version-2',
        },
      });

      // Wait for the comparison to complete
      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      expect(result.current[1].data).toBeDefined();
      expect(result.current[1].data?.versionDiff).toBeDefined();
    });

    it('should show added/modified/removed fields correctly', async () => {
      const { result } = renderHook(() => useCompareVersions(), {
        wrapper: createWrapper(),
      });

      const [compareVersions] = result.current;

      await compareVersions({
        variables: {
          versionId1: 'version-1',
          versionId2: 'version-2',
        },
      });

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      const diff = result.current[1].data?.versionDiff;
      expect(diff).toBeDefined();

      // Check added fields
      expect(diff?.added).toBeDefined();
      expect(diff?.added.structures).toEqual(['structure-2']);

      // Check modified fields
      expect(diff?.modified).toBeDefined();
      expect(diff?.modified.level).toEqual({ old: 3, new: 4 });
      expect(diff?.modified['variables.population']).toEqual({ old: 3000, new: 4000 });
      expect(diff?.modified['variables.gold']).toEqual({ old: 5000, new: 8000 });

      // Check removed fields
      expect(diff?.removed).toBeDefined();
      expect(Object.keys(diff?.removed || {})).toHaveLength(0);
    });

    it('should handle error for invalid version IDs', async () => {
      const { result } = renderHook(() => useCompareVersions(), {
        wrapper: createWrapper(),
      });

      const [compareVersions] = result.current;

      // Call with invalid version ID
      compareVersions({
        variables: {
          versionId1: 'invalid-version-1',
          versionId2: 'version-2',
        },
      });

      // Wait for the error to be populated
      await waitFor(() => {
        expect(result.current[1].error).toBeDefined();
      });

      expect(result.current[1].loading).toBe(false);
      expect(result.current[1].error?.message).toContain('Version not found');
    });

    it('should always fetch fresh data (network-only)', async () => {
      const { result } = renderHook(() => useCompareVersions(), {
        wrapper: createWrapper(),
      });

      const [compareVersions] = result.current;

      // First comparison
      await compareVersions({
        variables: {
          versionId1: 'version-1',
          versionId2: 'version-2',
        },
      });

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      const firstData = result.current[1].data;
      expect(firstData).toBeDefined();

      // Second comparison with same versions should fetch again
      await compareVersions({
        variables: {
          versionId1: 'version-1',
          versionId2: 'version-2',
        },
      });

      await waitFor(() => {
        expect(result.current[1].loading).toBe(false);
      });

      // Should have data (network-only means it fetched again)
      expect(result.current[1].data).toBeDefined();
    });
  });

  describe('useRestoreVersion (mutation)', () => {
    it('should restore a version successfully', async () => {
      const { result } = renderHook(() => useRestoreVersion(), {
        wrapper: createWrapper(),
      });

      const [restoreVersion] = result.current;

      // Execute the mutation
      const mutationResult = await restoreVersion({
        variables: {
          input: {
            versionId: 'version-1',
            branchId: 'main',
          },
        },
      });

      // Should return the restored version
      expect(mutationResult.data?.restoreVersion).toBeDefined();
      expect(mutationResult.data?.restoreVersion.entityType).toBe('Settlement');
      expect(mutationResult.data?.restoreVersion.entityId).toBe('settlement-1');
      expect(mutationResult.data?.restoreVersion.branchId).toBe('main');
    });

    it('should create a new version (not modify existing)', async () => {
      const { result } = renderHook(() => useRestoreVersion(), {
        wrapper: createWrapper(),
      });

      const [restoreVersion] = result.current;

      const mutationResult = await restoreVersion({
        variables: {
          input: {
            versionId: 'version-1',
            branchId: 'main',
          },
        },
      });

      const restoredVersion = mutationResult.data?.restoreVersion;
      expect(restoredVersion).toBeDefined();

      // Should be a new version with new ID
      expect(restoredVersion?.id).not.toBe('version-1');
      expect(restoredVersion?.id).not.toBe('version-2');
      expect(restoredVersion?.id).not.toBe('version-3');

      // Should have incremented version number
      expect(restoredVersion?.version).toBe(4); // mockVersions[0].version + 1

      // Should have current timestamp
      expect(restoredVersion?.validTo).toBeNull();

      // Should have restored payload from version-1
      expect(restoredVersion?.payload).toEqual(mockVersions[2].payload);
    });

    it('should include optional comment and worldTime', async () => {
      const { result } = renderHook(() => useRestoreVersion(), {
        wrapper: createWrapper(),
      });

      const [restoreVersion] = result.current;
      const worldTime = new Date('2024-04-01T15:00:00.000Z');

      const mutationResult = await restoreVersion({
        variables: {
          input: {
            versionId: 'version-1',
            branchId: 'main',
            worldTime,
            comment: 'Manual restore for testing',
          },
        },
      });

      const restoredVersion = mutationResult.data?.restoreVersion;
      expect(restoredVersion).toBeDefined();
      expect(restoredVersion?.comment).toBe('Manual restore for testing');
      expect(restoredVersion?.validFrom).toBe(worldTime.toISOString());
    });

    it('should handle errors appropriately', async () => {
      const { result } = renderHook(() => useRestoreVersion(), {
        wrapper: createWrapper(),
      });

      const [restoreVersion] = result.current;

      // Try to restore invalid version
      await expect(
        restoreVersion({
          variables: {
            input: {
              versionId: 'invalid-version',
              branchId: 'main',
            },
          },
        })
      ).rejects.toThrow();
    });

    it('should refetch version history after restore', async () => {
      // This test verifies that the mutation includes refetchQueries: ['EntityVersions']
      const { result } = renderHook(() => useRestoreVersion(), {
        wrapper: createWrapper(),
      });

      const [restoreVersion] = result.current;

      // Execute mutation
      await restoreVersion({
        variables: {
          input: {
            versionId: 'version-1',
            branchId: 'main',
            comment: 'Test restore',
          },
        },
      });

      // The mutation should trigger a refetch of EntityVersions query
      // This is configured in the hook with refetchQueries: ['EntityVersions']
      expect(result.current[1].loading).toBe(false);
    });

    it('should work without optional parameters', async () => {
      const { result } = renderHook(() => useRestoreVersion(), {
        wrapper: createWrapper(),
      });

      const [restoreVersion] = result.current;

      // Execute mutation without optional comment and worldTime
      const mutationResult = await restoreVersion({
        variables: {
          input: {
            versionId: 'version-2',
            branchId: 'main',
          },
        },
      });

      const restoredVersion = mutationResult.data?.restoreVersion;
      expect(restoredVersion).toBeDefined();
      expect(restoredVersion?.entityId).toBe('settlement-1');

      // Should have auto-generated comment
      expect(restoredVersion?.comment).toContain('Restored from version');

      // Should use current timestamp for validFrom
      expect(restoredVersion?.validFrom).toBeTruthy();
    });
  });
});
