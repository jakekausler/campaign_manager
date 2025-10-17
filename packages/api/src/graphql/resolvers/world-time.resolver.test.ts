/**
 * World Time Resolver Tests
 * Integration tests for world time GraphQL queries and mutations
 */

import type { AuthenticatedUser } from '../context/graphql-context';
import type { WorldTimeService } from '../services/world-time.service';

import { WorldTimeResolver } from './world-time.resolver';

describe('WorldTimeResolver', () => {
  let resolver: WorldTimeResolver;
  let mockWorldTimeService: jest.Mocked<WorldTimeService>;
  let mockUser: AuthenticatedUser;

  beforeEach(() => {
    // Create mock WorldTimeService
    mockWorldTimeService = {
      getCurrentWorldTime: jest.fn(),
      advanceWorldTime: jest.fn(),
    } as unknown as jest.Mocked<WorldTimeService>;

    // Create resolver with mock
    resolver = new WorldTimeResolver(mockWorldTimeService);

    // Create mock user
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'gm',
    } as AuthenticatedUser;
  });

  describe('getCurrentWorldTime', () => {
    it('should return current world time for valid campaign', async () => {
      const mockWorldTime = new Date('4707-03-15T12:00:00Z');
      mockWorldTimeService.getCurrentWorldTime.mockResolvedValue(mockWorldTime);

      const result = await resolver.getCurrentWorldTime('campaign-123', mockUser);

      expect(mockWorldTimeService.getCurrentWorldTime).toHaveBeenCalledWith(
        'campaign-123',
        mockUser
      );
      expect(result).toEqual(mockWorldTime);
    });

    it('should return null when campaign has no world time set', async () => {
      mockWorldTimeService.getCurrentWorldTime.mockResolvedValue(null);

      const result = await resolver.getCurrentWorldTime('campaign-456', mockUser);

      expect(mockWorldTimeService.getCurrentWorldTime).toHaveBeenCalledWith(
        'campaign-456',
        mockUser
      );
      expect(result).toBeNull();
    });

    it('should pass correct parameters to service', async () => {
      mockWorldTimeService.getCurrentWorldTime.mockResolvedValue(null);

      await resolver.getCurrentWorldTime('campaign-789', mockUser);

      expect(mockWorldTimeService.getCurrentWorldTime).toHaveBeenCalledWith(
        'campaign-789',
        mockUser
      );
      expect(mockWorldTimeService.getCurrentWorldTime).toHaveBeenCalledTimes(1);
    });
  });

  describe('advanceWorldTime', () => {
    it('should advance world time with all required parameters', async () => {
      const newTime = new Date('4707-03-16T12:00:00Z');
      const previousTime = new Date('4707-03-15T12:00:00Z');

      const mockResult = {
        campaignId: 'campaign-123',
        previousWorldTime: previousTime,
        currentWorldTime: newTime,
        affectedEntities: 0,
        message: 'World time advanced successfully',
      };

      mockWorldTimeService.advanceWorldTime.mockResolvedValue(mockResult);

      const result = await resolver.advanceWorldTime(
        {
          campaignId: 'campaign-123',
          to: newTime,
        },
        mockUser
      );

      expect(mockWorldTimeService.advanceWorldTime).toHaveBeenCalledWith(
        'campaign-123',
        newTime,
        'user-123',
        0, // expectedVersion - GraphQL layer defaults to 0
        undefined, // branchId
        undefined // invalidateCache
      );
      expect(result).toEqual(mockResult);
      expect(result.currentWorldTime).toEqual(newTime);
      expect(result.previousWorldTime).toEqual(previousTime);
    });

    it('should advance world time with all optional parameters', async () => {
      const newTime = new Date('4707-03-16T12:00:00Z');
      const previousTime = new Date('4707-03-15T12:00:00Z');

      const mockResult = {
        campaignId: 'campaign-123',
        previousWorldTime: previousTime,
        currentWorldTime: newTime,
        affectedEntities: 0,
        message: 'World time advanced successfully',
      };

      mockWorldTimeService.advanceWorldTime.mockResolvedValue(mockResult);

      const result = await resolver.advanceWorldTime(
        {
          campaignId: 'campaign-123',
          to: newTime,
          branchId: 'branch-1',
          invalidateCache: false,
        },
        mockUser
      );

      expect(mockWorldTimeService.advanceWorldTime).toHaveBeenCalledWith(
        'campaign-123',
        newTime,
        'user-123',
        0, // expectedVersion - GraphQL layer defaults to 0
        'branch-1',
        false
      );
      expect(result).toEqual(mockResult);
    });

    it('should handle first-time world time setting (no previous time)', async () => {
      const newTime = new Date('4707-03-15T12:00:00Z');

      const mockResult = {
        campaignId: 'campaign-456',
        previousWorldTime: undefined,
        currentWorldTime: newTime,
        affectedEntities: 0,
        message: 'World time set successfully',
      };

      mockWorldTimeService.advanceWorldTime.mockResolvedValue(mockResult);

      const result = await resolver.advanceWorldTime(
        {
          campaignId: 'campaign-456',
          to: newTime,
        },
        mockUser
      );

      expect(result.previousWorldTime).toBeUndefined();
      expect(result.currentWorldTime).toEqual(newTime);
      expect(result.message).toBe('World time set successfully');
    });

    it('should use default invalidateCache value when not specified', async () => {
      const newTime = new Date('4707-03-16T12:00:00Z');

      const mockResult = {
        campaignId: 'campaign-123',
        previousWorldTime: new Date('4707-03-15T12:00:00Z'),
        currentWorldTime: newTime,
        affectedEntities: 0,
        message: 'World time advanced successfully',
      };

      mockWorldTimeService.advanceWorldTime.mockResolvedValue(mockResult);

      await resolver.advanceWorldTime(
        {
          campaignId: 'campaign-123',
          to: newTime,
          // invalidateCache not specified, should be undefined (service default is true)
        },
        mockUser
      );

      expect(mockWorldTimeService.advanceWorldTime).toHaveBeenCalledWith(
        'campaign-123',
        newTime,
        'user-123',
        0, // expectedVersion - GraphQL layer defaults to 0
        undefined,
        undefined // invalidateCache is undefined, service will use default (true)
      );
    });

    it('should extract user ID from authenticated user', async () => {
      const newTime = new Date('4707-03-16T12:00:00Z');
      const customUser = {
        id: 'custom-user-456',
        email: 'custom@example.com',
        role: 'owner',
      } as AuthenticatedUser;

      const mockResult = {
        campaignId: 'campaign-123',
        previousWorldTime: undefined,
        currentWorldTime: newTime,
        affectedEntities: 0,
        message: 'World time advanced successfully',
      };

      mockWorldTimeService.advanceWorldTime.mockResolvedValue(mockResult);

      await resolver.advanceWorldTime(
        {
          campaignId: 'campaign-123',
          to: newTime,
        },
        customUser
      );

      // Verify the resolver extracts user.id correctly
      expect(mockWorldTimeService.advanceWorldTime).toHaveBeenCalledWith(
        'campaign-123',
        newTime,
        'custom-user-456', // Should use the custom user's ID
        0, // expectedVersion - GraphQL layer defaults to 0
        undefined,
        undefined
      );
    });
  });
});
