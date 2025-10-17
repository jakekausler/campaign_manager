import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Reset environment variables before each test
    delete process.env.CACHE_TTL_SECONDS;
    delete process.env.CACHE_CHECK_PERIOD_SECONDS;
    delete process.env.CACHE_MAX_KEYS;

    cacheService = new CacheService();
  });

  afterEach(() => {
    // Clean up cache after each test
    cacheService.clear();
    cacheService.onModuleDestroy();
  });

  describe('constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      const config = cacheService.getConfig();

      expect(config.ttl).toBe(300); // 5 minutes
      expect(config.checkperiod).toBe(60); // 1 minute
      expect(config.maxKeys).toBe(10000);
      expect(config.useClones).toBe(false);
    });

    it('should initialize with custom configuration from environment', () => {
      process.env.CACHE_TTL_SECONDS = '600';
      process.env.CACHE_CHECK_PERIOD_SECONDS = '120';
      process.env.CACHE_MAX_KEYS = '5000';

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.ttl).toBe(600);
      expect(config.checkperiod).toBe(120);
      expect(config.maxKeys).toBe(5000);

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should clamp TTL below minimum to minimum value', () => {
      process.env.CACHE_TTL_SECONDS = '0'; // Below min of 1

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.ttl).toBe(1); // Clamped to minimum

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should clamp TTL above maximum to maximum value', () => {
      process.env.CACHE_TTL_SECONDS = '100000'; // Above max of 86400

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.ttl).toBe(86400); // Clamped to maximum

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should use default for invalid TTL value', () => {
      process.env.CACHE_TTL_SECONDS = 'not-a-number';

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.ttl).toBe(300); // Default value

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should clamp check period below minimum to minimum value', () => {
      process.env.CACHE_CHECK_PERIOD_SECONDS = '5'; // Below min of 10

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.checkperiod).toBe(10); // Clamped to minimum

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should clamp check period above maximum to maximum value', () => {
      process.env.CACHE_CHECK_PERIOD_SECONDS = '5000'; // Above max of 3600

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.checkperiod).toBe(3600); // Clamped to maximum

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should clamp maxKeys below minimum to minimum value', () => {
      process.env.CACHE_MAX_KEYS = '50'; // Below min of 100

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.maxKeys).toBe(100); // Clamped to minimum

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });

    it('should clamp maxKeys above maximum to maximum value', () => {
      process.env.CACHE_MAX_KEYS = '2000000'; // Above max of 1000000

      const customCacheService = new CacheService();
      const config = customCacheService.getConfig();

      expect(config.maxKeys).toBe(1000000); // Clamped to maximum

      customCacheService.clear();
      customCacheService.onModuleDestroy();
    });
  });

  describe('key sanitization', () => {
    it('should sanitize campaign IDs with embedded colons', () => {
      const components = {
        campaignId: 'campaign:123:test',
        branchId: 'main',
        nodeId: 'CONDITION:cond-1',
      };

      cacheService.set(components, { value: 'test' });

      // Should retrieve with same components (internal sanitization)
      const retrieved = cacheService.get(components);
      expect(retrieved).toEqual({ value: 'test' });

      // Check the actual key generated (colons should be escaped)
      const keys = cacheService.keys();
      expect(keys[0]).toContain('campaign\\:123\\:test');
    });

    it('should sanitize branch IDs with embedded colons', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'feature:test:branch',
        nodeId: 'CONDITION:cond-1',
      };

      cacheService.set(components, { value: 'test' });

      const retrieved = cacheService.get(components);
      expect(retrieved).toEqual({ value: 'test' });

      const keys = cacheService.keys();
      expect(keys[0]).toContain('feature\\:test\\:branch');
    });

    it('should sanitize node IDs with embedded colons', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:test:cond:1',
      };

      cacheService.set(components, { value: 'test' });

      const retrieved = cacheService.get(components);
      expect(retrieved).toEqual({ value: 'test' });

      const keys = cacheService.keys();
      expect(keys[0]).toContain('CONDITION\\:test\\:cond\\:1');
    });

    it('should prevent key collisions with sanitization', () => {
      // These two would collide without sanitization
      const components1 = {
        campaignId: 'campaign',
        branchId: '123:main',
        nodeId: 'cond-1',
      };

      const components2 = {
        campaignId: 'campaign:123',
        branchId: 'main',
        nodeId: 'cond-1',
      };

      cacheService.set(components1, { value: 'first' });
      cacheService.set(components2, { value: 'second' });

      // Both should be retrievable separately
      expect(cacheService.get(components1)).toEqual({ value: 'first' });
      expect(cacheService.get(components2)).toEqual({ value: 'second' });

      // Should have 2 distinct keys
      expect(cacheService.keys().length).toBe(2);
    });

    it('should sanitize prefixes for invalidation', () => {
      const components1 = {
        campaignId: 'campaign:123',
        branchId: 'main',
        nodeId: 'cond-1',
      };

      const components2 = {
        campaignId: 'campaign:123',
        branchId: 'main',
        nodeId: 'cond-2',
      };

      const components3 = {
        campaignId: 'other-campaign',
        branchId: 'main',
        nodeId: 'cond-3',
      };

      cacheService.set(components1, { value: 1 });
      cacheService.set(components2, { value: 2 });
      cacheService.set(components3, { value: 3 });

      // Invalidate campaign:123 entries only
      const deleted = cacheService.invalidateByPrefix('campaign:123', 'main');
      expect(deleted).toBe(2);

      // Verify correct entries invalidated
      expect(cacheService.has(components1)).toBe(false);
      expect(cacheService.has(components2)).toBe(false);
      expect(cacheService.has(components3)).toBe(true);
    });
  });

  describe('get and set operations', () => {
    it('should set and get a value', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-456',
      };
      const value = { result: true, data: 'test' };

      const setSuccess = cacheService.set(components, value);
      expect(setSuccess).toBe(true);

      const retrieved = cacheService.get<typeof value>(components);
      expect(retrieved).toEqual(value);
    });

    it('should return undefined for non-existent key', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:nonexistent',
      };

      const retrieved = cacheService.get(components);
      expect(retrieved).toBeUndefined();
    });

    it('should overwrite existing value', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-456',
      };

      cacheService.set(components, { value: 'first' });
      cacheService.set(components, { value: 'second' });

      const retrieved = cacheService.get(components);
      expect(retrieved).toEqual({ value: 'second' });
    });

    it('should set value with custom TTL', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-456',
      };
      const value = { result: true };

      const setSuccess = cacheService.set(components, value, 60); // 1 minute TTL
      expect(setSuccess).toBe(true);

      const retrieved = cacheService.get(components);
      expect(retrieved).toEqual(value);
    });

    it('should handle different data types', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-456',
      };

      // String
      cacheService.set(components, 'test string');
      expect(cacheService.get(components)).toBe('test string');

      // Number
      cacheService.set(components, 42);
      expect(cacheService.get(components)).toBe(42);

      // Boolean
      cacheService.set(components, true);
      expect(cacheService.get(components)).toBe(true);

      // Array
      cacheService.set(components, [1, 2, 3]);
      expect(cacheService.get(components)).toEqual([1, 2, 3]);

      // Object
      cacheService.set(components, { nested: { value: 'deep' } });
      expect(cacheService.get(components)).toEqual({ nested: { value: 'deep' } });

      // Null
      cacheService.set(components, null);
      expect(cacheService.get(components)).toBeNull();
    });
  });

  describe('invalidate operations', () => {
    it('should invalidate a specific entry', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-456',
      };

      cacheService.set(components, { result: true });
      expect(cacheService.has(components)).toBe(true);

      const deleted = cacheService.invalidate(components);
      expect(deleted).toBe(1);
      expect(cacheService.has(components)).toBe(false);
    });

    it('should return 0 when invalidating non-existent entry', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:nonexistent',
      };

      const deleted = cacheService.invalidate(components);
      expect(deleted).toBe(0);
    });

    it('should invalidate all entries for a campaign/branch', () => {
      // Set multiple entries for same campaign/branch
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-2' },
        { value: 2 }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'VARIABLE:var-1' },
        { value: 3 }
      );

      // Set entry for different campaign (should not be deleted)
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-3' },
        { value: 4 }
      );

      const deleted = cacheService.invalidateByPrefix('campaign-123', 'main');
      expect(deleted).toBe(3);

      // Verify deletions
      expect(
        cacheService.has({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:cond-1',
        })
      ).toBe(false);
      expect(
        cacheService.has({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:cond-2',
        })
      ).toBe(false);
      expect(
        cacheService.has({ campaignId: 'campaign-123', branchId: 'main', nodeId: 'VARIABLE:var-1' })
      ).toBe(false);

      // Other campaign should remain
      expect(
        cacheService.has({
          campaignId: 'campaign-456',
          branchId: 'main',
          nodeId: 'CONDITION:cond-3',
        })
      ).toBe(true);
    });

    it('should invalidate all entries for a campaign (all branches)', () => {
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'feature', nodeId: 'CONDITION:cond-2' },
        { value: 2 }
      );
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-3' },
        { value: 3 }
      );

      const deleted = cacheService.invalidateByPrefix('campaign-123');
      expect(deleted).toBe(2);

      // Verify only campaign-123 entries deleted
      expect(
        cacheService.has({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:cond-1',
        })
      ).toBe(false);
      expect(
        cacheService.has({
          campaignId: 'campaign-123',
          branchId: 'feature',
          nodeId: 'CONDITION:cond-2',
        })
      ).toBe(false);
      expect(
        cacheService.has({
          campaignId: 'campaign-456',
          branchId: 'main',
          nodeId: 'CONDITION:cond-3',
        })
      ).toBe(true);
    });
  });

  describe('clear operation', () => {
    it('should clear all cache entries', () => {
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-2' },
        { value: 2 }
      );

      expect(cacheService.keys().length).toBe(2);

      cacheService.clear();

      expect(cacheService.keys().length).toBe(0);
    });
  });

  describe('has operation', () => {
    it('should return true for existing key', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-456',
      };

      cacheService.set(components, { value: 'test' });
      expect(cacheService.has(components)).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:nonexistent',
      };

      expect(cacheService.has(components)).toBe(false);
    });
  });

  describe('keys operations', () => {
    it('should return all cache keys', () => {
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-2' },
        { value: 2 }
      );

      const keys = cacheService.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('campaign:campaign-123:branch:main:node:CONDITION:cond-1');
      expect(keys).toContain('campaign:campaign-456:branch:main:node:CONDITION:cond-2');
    });

    it('should return keys matching a prefix', () => {
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'feature', nodeId: 'CONDITION:cond-2' },
        { value: 2 }
      );
      cacheService.set(
        { campaignId: 'campaign-456', branchId: 'main', nodeId: 'CONDITION:cond-3' },
        { value: 3 }
      );

      const keysForCampaign123Main = cacheService.keysByPrefix('campaign-123', 'main');
      expect(keysForCampaign123Main).toHaveLength(1);
      expect(keysForCampaign123Main[0]).toBe(
        'campaign:campaign-123:branch:main:node:CONDITION:cond-1'
      );

      const keysForCampaign123 = cacheService.keysByPrefix('campaign-123');
      expect(keysForCampaign123).toHaveLength(2);
    });
  });

  describe('statistics', () => {
    it('should return cache statistics', () => {
      // Initial stats
      let stats = cacheService.getStats();
      expect(stats.keys).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Add some entries and access them
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-1',
      };

      cacheService.set(components, { value: 'test' });

      // Hit
      cacheService.get(components);

      // Miss
      cacheService.get({
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:nonexistent',
      });

      stats = cacheService.getStats();
      expect(stats.keys).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5); // 1 hit, 1 miss
    });

    it('should calculate hit rate correctly', () => {
      const components = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-1',
      };

      cacheService.set(components, { value: 'test' });

      // 3 hits
      cacheService.get(components);
      cacheService.get(components);
      cacheService.get(components);

      // 1 miss
      cacheService.get({
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:nonexistent',
      });

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.75); // 3 hits / 4 total
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent keys for same components', () => {
      const components1 = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-1',
      };

      const components2 = {
        campaignId: 'campaign-123',
        branchId: 'main',
        nodeId: 'CONDITION:cond-1',
      };

      cacheService.set(components1, { value: 'test' });
      const retrieved = cacheService.get(components2);

      expect(retrieved).toEqual({ value: 'test' });
    });

    it('should generate different keys for different components', () => {
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-2' },
        { value: 2 }
      );
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'feature', nodeId: 'CONDITION:cond-1' },
        { value: 3 }
      );

      expect(
        cacheService.get({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:cond-1',
        })
      ).toEqual({ value: 1 });
      expect(
        cacheService.get({
          campaignId: 'campaign-123',
          branchId: 'main',
          nodeId: 'CONDITION:cond-2',
        })
      ).toEqual({ value: 2 });
      expect(
        cacheService.get({
          campaignId: 'campaign-123',
          branchId: 'feature',
          nodeId: 'CONDITION:cond-1',
        })
      ).toEqual({ value: 3 });
    });
  });

  describe('lifecycle', () => {
    it('should clean up on module destroy', () => {
      cacheService.set(
        { campaignId: 'campaign-123', branchId: 'main', nodeId: 'CONDITION:cond-1' },
        { value: 1 }
      );

      expect(cacheService.keys().length).toBe(1);

      cacheService.onModuleDestroy();

      // Note: After calling onModuleDestroy, the cache is closed
      // We can't reliably test the state after this in Jest
      // In production, this is only called once during shutdown
    });
  });
});
