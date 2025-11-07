import { Test, TestingModule } from '@nestjs/testing';

import { REDIS_CACHE } from '../../graphql/cache/redis-cache.provider';

import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let redis: {
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    scan: jest.Mock;
  };

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.CACHE_DEFAULT_TTL = '300';
    process.env.CACHE_METRICS_ENABLED = 'true';
    process.env.CACHE_LOGGING_ENABLED = 'false';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: REDIS_CACHE,
          useValue: {
            get: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            scan: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redis = module.get(REDIS_CACHE);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed value on cache hit', async () => {
      const testData = { id: 123, name: 'Settlement' };
      redis.get.mockResolvedValue(JSON.stringify(testData));

      const result = await service.get<typeof testData>('computed-fields:settlement:123:main');

      expect(result).toEqual(testData);
      expect(redis.get).toHaveBeenCalledWith('computed-fields:settlement:123:main');
    });

    it('should return null on cache miss', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.get('computed-fields:settlement:123:main');

      expect(result).toBeNull();
      expect(redis.get).toHaveBeenCalledWith('computed-fields:settlement:123:main');
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        settlement: {
          id: 123,
          name: 'Test',
          structures: [
            { id: 1, type: 'building' },
            { id: 2, type: 'road' },
          ],
        },
        metadata: {
          computed: true,
          timestamp: new Date().toISOString(),
        },
      };
      redis.get.mockResolvedValue(JSON.stringify(complexData));

      const result = await service.get('computed-fields:settlement:123:main');

      expect(result).toEqual(complexData);
    });

    it('should return null on JSON parse error', async () => {
      redis.get.mockResolvedValue('invalid-json{');

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should return null and log error on Redis failure', async () => {
      redis.get.mockRejectedValue(new Error('Redis connection error'));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should increment hits counter on cache hit', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      await service.get('key1');
      await service.get('key2');

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    it('should increment misses counter on cache miss', async () => {
      redis.get.mockResolvedValue(null);

      await service.get('key1');
      await service.get('key2');

      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });

    it('should count errors as misses for accurate hit rate', async () => {
      redis.get.mockRejectedValue(new Error('Redis error'));

      await service.get('key1');

      const stats = service.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should handle empty string values', async () => {
      redis.get.mockResolvedValue(JSON.stringify(''));

      const result = await service.get<string>('test-key');

      expect(result).toBe('');
    });

    it('should handle boolean values', async () => {
      redis.get.mockResolvedValue(JSON.stringify(false));

      const result = await service.get<boolean>('test-key');

      expect(result).toBe(false);
    });

    it('should handle null values stored as JSON', async () => {
      redis.get.mockResolvedValue(JSON.stringify(null));

      const result = await service.get('test-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store value with default TTL', async () => {
      const testData = { id: 123, name: 'Settlement' };
      redis.setex.mockResolvedValue('OK');

      await service.set('computed-fields:settlement:123:main', testData);

      expect(redis.setex).toHaveBeenCalledWith(
        'computed-fields:settlement:123:main',
        300, // Default TTL from env
        JSON.stringify(testData)
      );
    });

    it('should store value with custom TTL', async () => {
      const testData = { id: 456 };
      redis.setex.mockResolvedValue('OK');

      await service.set('test-key', testData, { ttl: 600 });

      expect(redis.setex).toHaveBeenCalledWith('test-key', 600, JSON.stringify(testData));
    });

    it('should serialize complex objects', async () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { deep: { value: 'test' } },
        date: new Date().toISOString(),
      };
      redis.setex.mockResolvedValue('OK');

      await service.set('complex-key', complexData);

      expect(redis.setex).toHaveBeenCalledWith('complex-key', 300, JSON.stringify(complexData));
    });

    it('should increment sets counter', async () => {
      redis.setex.mockResolvedValue('OK');

      await service.set('key1', { data: 'test1' });
      await service.set('key2', { data: 'test2' });

      const stats = service.getStats();
      expect(stats.sets).toBe(2);
    });

    it('should not throw on Redis failure (graceful degradation)', async () => {
      redis.setex.mockRejectedValue(new Error('Redis write error'));

      await expect(service.set('test-key', { data: 'test' })).resolves.not.toThrow();
    });

    it('should handle primitive values', async () => {
      redis.setex.mockResolvedValue('OK');

      await service.set('string-key', 'test-string');
      await service.set('number-key', 42);
      await service.set('boolean-key', true);

      expect(redis.setex).toHaveBeenCalledTimes(3);
      expect(redis.setex).toHaveBeenNthCalledWith(
        1,
        'string-key',
        300,
        JSON.stringify('test-string')
      );
      expect(redis.setex).toHaveBeenNthCalledWith(2, 'number-key', 300, JSON.stringify(42));
      expect(redis.setex).toHaveBeenNthCalledWith(3, 'boolean-key', 300, JSON.stringify(true));
    });

    it('should handle null values', async () => {
      redis.setex.mockResolvedValue('OK');

      await service.set('null-key', null);

      expect(redis.setex).toHaveBeenCalledWith('null-key', 300, JSON.stringify(null));
    });

    it('should handle arrays', async () => {
      const arrayData = [1, 2, 3, 4, 5];
      redis.setex.mockResolvedValue('OK');

      await service.set('array-key', arrayData);

      expect(redis.setex).toHaveBeenCalledWith('array-key', 300, JSON.stringify(arrayData));
    });
  });

  describe('del', () => {
    it('should delete key and return count', async () => {
      redis.del.mockResolvedValue(1);

      const result = await service.del('computed-fields:settlement:123:main');

      expect(result).toBe(1);
      expect(redis.del).toHaveBeenCalledWith('computed-fields:settlement:123:main');
    });

    it('should return 0 if key does not exist', async () => {
      redis.del.mockResolvedValue(0);

      const result = await service.del('non-existent-key');

      expect(result).toBe(0);
    });

    it('should increment deletes counter', async () => {
      redis.del.mockResolvedValue(1);

      await service.del('key1');
      await service.del('key2');

      const stats = service.getStats();
      expect(stats.deletes).toBe(2);
    });

    it('should return 0 on Redis failure (graceful degradation)', async () => {
      redis.del.mockRejectedValue(new Error('Redis delete error'));

      const result = await service.del('test-key');

      expect(result).toBe(0);
    });

    it('should handle multiple sequential deletes', async () => {
      redis.del.mockResolvedValueOnce(1).mockResolvedValueOnce(0).mockResolvedValueOnce(1);

      const result1 = await service.del('key1');
      const result2 = await service.del('key2');
      const result3 = await service.del('key3');

      expect(result1).toBe(1);
      expect(result2).toBe(0);
      expect(result3).toBe(1);
      expect(redis.del).toHaveBeenCalledTimes(3);
    });
  });

  describe('delPattern', () => {
    it('should delete all keys matching pattern', async () => {
      redis.scan.mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
      redis.del.mockResolvedValue(3);

      const result = await service.delPattern('computed-fields:*');

      expect(result).toEqual({
        success: true,
        keysDeleted: 3,
      });
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'computed-fields:*', 'COUNT', 100);
      expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle paginated SCAN results', async () => {
      redis.scan
        .mockResolvedValueOnce(['1', ['key1', 'key2']])
        .mockResolvedValueOnce(['2', ['key3', 'key4']])
        .mockResolvedValueOnce(['0', ['key5']]);
      redis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.delPattern('*:main');

      expect(result).toEqual({
        success: true,
        keysDeleted: 5,
      });
      expect(redis.scan).toHaveBeenCalledTimes(3);
      expect(redis.del).toHaveBeenCalledTimes(3);
    });

    it('should handle SCAN with no matching keys', async () => {
      redis.scan.mockResolvedValue(['0', []]);

      const result = await service.delPattern('non-existent-pattern:*');

      expect(result).toEqual({
        success: true,
        keysDeleted: 0,
      });
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'non-existent-pattern:*', 'COUNT', 100);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should increment patternDeletes counter', async () => {
      redis.scan.mockResolvedValue(['0', ['key1', 'key2']]);
      redis.del.mockResolvedValue(2);

      await service.delPattern('pattern1:*');
      await service.delPattern('pattern2:*');

      const stats = service.getStats();
      expect(stats.patternDeletes).toBe(2);
    });

    it('should return failure on Redis error', async () => {
      redis.scan.mockRejectedValue(new Error('Redis scan error'));

      const result = await service.delPattern('test-pattern:*');

      expect(result).toEqual({
        success: false,
        keysDeleted: 0,
        error: 'Redis scan error',
      });
    });

    it('should handle entity-specific patterns', async () => {
      redis.scan.mockResolvedValue([
        '0',
        ['computed-fields:settlement:123:main', 'spatial:settlement:123:main'],
      ]);
      redis.del.mockResolvedValue(2);

      const result = await service.delPattern('*:settlement:123:main');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(2);
    });

    it('should handle branch-specific patterns', async () => {
      redis.scan.mockResolvedValue([
        '0',
        [
          'computed-fields:settlement:123:main',
          'settlements:kingdom:456:main',
          'spatial:query:main',
        ],
      ]);
      redis.del.mockResolvedValue(3);

      const result = await service.delPattern('*:main');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(3);
    });

    it('should handle SCAN with some empty batches', async () => {
      redis.scan
        .mockResolvedValueOnce(['1', ['key1', 'key2']])
        .mockResolvedValueOnce(['2', []])
        .mockResolvedValueOnce(['0', ['key3']]);
      redis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.delPattern('test:*');

      expect(result.keysDeleted).toBe(3);
      expect(redis.del).toHaveBeenCalledTimes(2); // Only called for non-empty batches
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = service.getStats();

      expect(stats).toEqual({
        hits: 0,
        misses: 0,
        hitRate: 0,
        sets: 0,
        deletes: 0,
        patternDeletes: 0,
        startTime: expect.any(Number),
        enabled: true,
      });
    });

    it('should calculate hit rate correctly', async () => {
      redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));
      redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));
      redis.get.mockResolvedValueOnce(null);
      redis.get.mockResolvedValueOnce(null);

      await service.get('key1'); // hit
      await service.get('key2'); // hit
      await service.get('key3'); // miss
      await service.get('key4'); // miss

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5); // 2 hits / 4 total = 50%
    });

    it('should track all operation types', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      redis.setex.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);
      redis.scan.mockResolvedValue(['0', ['key1']]);
      redis.del.mockResolvedValue(1);

      await service.get('key1'); // hit
      await service.set('key2', { data: 'test' }); // set
      await service.del('key3'); // delete
      await service.delPattern('pattern:*'); // pattern delete

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.patternDeletes).toBe(1);
    });

    it('should return hitRate of 0 when no operations', () => {
      const stats = service.getStats();
      expect(stats.hitRate).toBe(0);
    });

    it('should calculate hitRate of 1.0 for all hits', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));

      await service.get('key1');
      await service.get('key2');
      await service.get('key3');

      const stats = service.getStats();
      expect(stats.hitRate).toBe(1.0);
    });

    it('should calculate hitRate of 0.0 for all misses', async () => {
      redis.get.mockResolvedValue(null);

      await service.get('key1');
      await service.get('key2');
      await service.get('key3');

      const stats = service.getStats();
      expect(stats.hitRate).toBe(0.0);
    });
  });

  describe('resetStats', () => {
    it('should reset all stats counters', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      redis.setex.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      await service.get('key1');
      await service.set('key2', { data: 'test' });
      await service.del('key3');

      service.resetStats();

      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.patternDeletes).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('should update startTime on reset', async () => {
      const initialStats = service.getStats();
      const initialStartTime = initialStats.startTime;

      await new Promise((resolve) => setTimeout(resolve, 10));

      service.resetStats();

      const newStats = service.getStats();
      expect(newStats.startTime).toBeGreaterThan(initialStartTime);
    });

    it('should preserve enabled flag', () => {
      service.resetStats();

      const stats = service.getStats();
      expect(stats.enabled).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should use environment variable for default TTL', async () => {
      redis.setex.mockResolvedValue('OK');

      await service.set('test-key', { data: 'test' });

      expect(redis.setex).toHaveBeenCalledWith('test-key', 300, expect.any(String));
    });

    it('should respect metrics enabled flag', () => {
      const stats = service.getStats();
      expect(stats.enabled).toBe(true);
    });
  });

  describe('Graceful degradation', () => {
    it('should continue operating after get failure', async () => {
      redis.get.mockRejectedValueOnce(new Error('Connection lost'));
      redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' }));

      const result1 = await service.get('key1');
      const result2 = await service.get('key2');

      expect(result1).toBeNull();
      expect(result2).toEqual({ data: 'test' });
    });

    it('should continue operating after set failure', async () => {
      redis.setex.mockRejectedValueOnce(new Error('Write failed'));
      redis.setex.mockResolvedValueOnce('OK');

      await service.set('key1', { data: 'test1' });
      await service.set('key2', { data: 'test2' });

      expect(redis.setex).toHaveBeenCalledTimes(2);
    });

    it('should continue operating after del failure', async () => {
      redis.del.mockRejectedValueOnce(new Error('Delete failed'));
      redis.del.mockResolvedValueOnce(1);

      const result1 = await service.del('key1');
      const result2 = await service.del('key2');

      expect(result1).toBe(0);
      expect(result2).toBe(1);
    });

    it('should return failure result for delPattern errors', async () => {
      redis.scan.mockRejectedValue(new Error('Scan failed'));

      const result = await service.delPattern('pattern:*');

      expect(result.success).toBe(false);
      expect(result.keysDeleted).toBe(0);
      expect(result.error).toBe('Scan failed');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle cache miss followed by set and hit', async () => {
      // First get - miss
      redis.get.mockResolvedValueOnce(null);
      const miss = await service.get('test-key');
      expect(miss).toBeNull();

      // Set value
      redis.setex.mockResolvedValue('OK');
      await service.set('test-key', { id: 123, name: 'Test' });

      // Second get - hit
      redis.get.mockResolvedValueOnce(JSON.stringify({ id: 123, name: 'Test' }));
      const hit = await service.get('test-key');
      expect(hit).toEqual({ id: 123, name: 'Test' });

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
    });

    it('should handle invalidation workflow', async () => {
      // Set multiple computed fields
      redis.setex.mockResolvedValue('OK');
      await service.set('computed-fields:settlement:123:main', { value: 1 });
      await service.set('computed-fields:settlement:456:main', { value: 2 });
      await service.set('computed-fields:kingdom:789:main', { value: 3 });

      // Invalidate all computed fields
      redis.scan.mockResolvedValue([
        '0',
        [
          'computed-fields:settlement:123:main',
          'computed-fields:settlement:456:main',
          'computed-fields:kingdom:789:main',
        ],
      ]);
      redis.del.mockResolvedValue(3);

      const result = await service.delPattern('computed-fields:*');

      expect(result.success).toBe(true);
      expect(result.keysDeleted).toBe(3);
    });

    it('should track accurate metrics over multiple operations', async () => {
      redis.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'cached' }))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(JSON.stringify({ data: 'cached' }));
      redis.setex.mockResolvedValue('OK');
      redis.del.mockResolvedValue(1);

      await service.get('key1'); // hit
      await service.get('key2'); // miss
      await service.set('key2', { data: 'new' }); // set
      await service.get('key1'); // hit
      await service.del('key1'); // delete

      const stats = service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2); // 2/3
    });
  });
});
