/**
 * Version Resolver Tests
 * Integration tests for Version GraphQL queries, mutations, and subscriptions
 */

import type { RedisPubSub } from 'graphql-redis-subscriptions';

import type { AuthenticatedUser } from '../context/graphql-context';
import type { VersionService } from '../services/version.service';
import { compressPayload } from '../utils/version.utils';

import { VersionResolver } from './version.resolver';

describe('VersionResolver', () => {
  let resolver: VersionResolver;
  let mockVersionService: jest.Mocked<VersionService>;
  let mockPubSub: jest.Mocked<RedisPubSub>;
  let mockUser: AuthenticatedUser;

  beforeEach(() => {
    // Create mock VersionService
    mockVersionService = {
      findVersionHistory: jest.fn(),
      getVersionDiff: jest.fn(),
      restoreVersion: jest.fn(),
    } as unknown as jest.Mocked<VersionService>;

    // Create mock RedisPubSub
    mockPubSub = {
      publish: jest.fn(),
      asyncIterator: jest.fn(),
    } as unknown as jest.Mocked<RedisPubSub>;

    // Create resolver with mocks
    resolver = new VersionResolver(mockVersionService, mockPubSub);

    // Create mock user
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    } as AuthenticatedUser;
  });

  describe('entityVersions', () => {
    it('should return version history with decompressed payloads', async () => {
      const payload1 = { name: 'Campaign v1', setting: { difficulty: 'normal' } };
      const payload2 = { name: 'Campaign v2', setting: { difficulty: 'hard' } };
      const payloadGz1 = await compressPayload(payload1);
      const payloadGz2 = await compressPayload(payload2);

      const mockVersions = [
        {
          id: 'version-1',
          entityType: 'campaign',
          entityId: 'campaign-123',
          branchId: 'branch-1',
          validFrom: new Date('2024-01-01'),
          validTo: new Date('2024-01-02'),
          payloadGz: payloadGz1,
          version: 1,
          comment: 'First version',
          createdBy: 'user-123',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'version-2',
          entityType: 'campaign',
          entityId: 'campaign-123',
          branchId: 'branch-1',
          validFrom: new Date('2024-01-02'),
          validTo: null,
          payloadGz: payloadGz2,
          version: 2,
          comment: 'Updated version',
          createdBy: 'user-123',
          createdAt: new Date('2024-01-02'),
        },
      ];

      mockVersionService.findVersionHistory.mockResolvedValue(mockVersions);

      const result = await resolver.entityVersions(
        'campaign',
        'campaign-123',
        'branch-1',
        mockUser
      );

      expect(mockVersionService.findVersionHistory).toHaveBeenCalledWith(
        'campaign',
        'campaign-123',
        'branch-1',
        mockUser
      );
      expect(result).toHaveLength(2);
      expect(result[0].payload).toEqual(payload1);
      expect(result[1].payload).toEqual(payload2);
      expect(result[0].id).toBe('version-1');
      expect(result[1].id).toBe('version-2');
    });

    it('should return empty array when no versions found', async () => {
      mockVersionService.findVersionHistory.mockResolvedValue([]);

      const result = await resolver.entityVersions(
        'campaign',
        'campaign-123',
        'branch-1',
        mockUser
      );

      expect(result).toEqual([]);
    });

    it('should pass correct parameters to service', async () => {
      mockVersionService.findVersionHistory.mockResolvedValue([]);

      await resolver.entityVersions('character', 'char-456', 'branch-2', mockUser);

      expect(mockVersionService.findVersionHistory).toHaveBeenCalledWith(
        'character',
        'char-456',
        'branch-2',
        mockUser
      );
    });
  });

  describe('versionDiff', () => {
    it('should return diff between two versions', async () => {
      const mockDiff = {
        added: { newField: 'value' },
        modified: { name: { old: 'Old Name', new: 'New Name' } },
        removed: { oldField: 'removed' },
      };

      mockVersionService.getVersionDiff.mockResolvedValue(mockDiff);

      const result = await resolver.versionDiff('version-1', 'version-2', mockUser);

      expect(mockVersionService.getVersionDiff).toHaveBeenCalledWith(
        'version-1',
        'version-2',
        mockUser
      );
      expect(result).toEqual(mockDiff);
      expect(result.added).toEqual({ newField: 'value' });
      expect(result.modified).toEqual({ name: { old: 'Old Name', new: 'New Name' } });
      expect(result.removed).toEqual({ oldField: 'removed' });
    });

    it('should return empty diff when versions are identical', async () => {
      const mockDiff = {
        added: {},
        modified: {},
        removed: {},
      };

      mockVersionService.getVersionDiff.mockResolvedValue(mockDiff);

      const result = await resolver.versionDiff('version-1', 'version-1', mockUser);

      expect(result.added).toEqual({});
      expect(result.modified).toEqual({});
      expect(result.removed).toEqual({});
    });
  });

  describe('restoreVersion', () => {
    it('should restore version with all required parameters', async () => {
      const payload = { name: 'Restored Campaign', setting: { difficulty: 'normal' } };
      const payloadGz = await compressPayload(payload);
      const worldTime = new Date('2024-01-03');

      const mockRestoredVersion = {
        id: 'version-3',
        entityType: 'campaign',
        entityId: 'campaign-123',
        branchId: 'branch-1',
        validFrom: worldTime,
        validTo: null,
        payloadGz,
        version: 3,
        comment: 'Restored from version-1',
        createdBy: 'user-123',
        createdAt: new Date('2024-01-03'),
      };

      mockVersionService.restoreVersion.mockResolvedValue(mockRestoredVersion);

      const result = await resolver.restoreVersion(
        {
          versionId: 'version-1',
          branchId: 'branch-1',
          worldTime,
          comment: 'Restored from version-1',
        },
        mockUser
      );

      expect(mockVersionService.restoreVersion).toHaveBeenCalledWith(
        'version-1',
        'branch-1',
        mockUser,
        worldTime,
        'Restored from version-1'
      );
      expect(result.payload).toEqual(payload);
      expect(result.id).toBe('version-3');
      expect(result.comment).toBe('Restored from version-1');
    });

    it('should restore version with optional parameters omitted', async () => {
      const payload = { name: 'Restored Campaign' };
      const payloadGz = await compressPayload(payload);

      const mockRestoredVersion = {
        id: 'version-4',
        entityType: 'campaign',
        entityId: 'campaign-123',
        branchId: 'branch-1',
        validFrom: new Date(),
        validTo: null,
        payloadGz,
        version: 4,
        comment: null,
        createdBy: 'user-123',
        createdAt: new Date(),
      };

      mockVersionService.restoreVersion.mockResolvedValue(mockRestoredVersion);

      const result = await resolver.restoreVersion(
        {
          versionId: 'version-1',
          branchId: 'branch-1',
        },
        mockUser
      );

      expect(mockVersionService.restoreVersion).toHaveBeenCalledWith(
        'version-1',
        'branch-1',
        mockUser,
        undefined,
        undefined
      );
      expect(result.payload).toEqual(payload);
      expect(result.comment).toBeUndefined(); // Resolver converts null to undefined
    });
  });

  describe('entityModified subscription', () => {
    it('should create async iterator with correct topic', () => {
      // Use a symbol to track the iterator without worrying about its structure
      const mockAsyncIterator = Symbol('asyncIterator');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPubSub.asyncIterator.mockReturnValue(mockAsyncIterator);

      const result = resolver.entityModified('entity-123');

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith('entity.modified.entity-123');
      expect(result).toBe(mockAsyncIterator);
    });

    it('should create different iterators for different entities', () => {
      const mockAsyncIterator1 = Symbol('asyncIterator1');
      const mockAsyncIterator2 = Symbol('asyncIterator2');
      mockPubSub.asyncIterator
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValueOnce(mockAsyncIterator1 as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockReturnValueOnce(mockAsyncIterator2 as any);

      const result1 = resolver.entityModified('entity-1');
      const result2 = resolver.entityModified('entity-2');

      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith('entity.modified.entity-1');
      expect(mockPubSub.asyncIterator).toHaveBeenCalledWith('entity.modified.entity-2');
      expect(result1).toBe(mockAsyncIterator1);
      expect(result2).toBe(mockAsyncIterator2);
    });
  });
});
