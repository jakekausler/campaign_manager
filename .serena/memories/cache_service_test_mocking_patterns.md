# CacheService Unit Test Mocking Patterns

## Overview

Research on how to mock Redis clients and external dependencies in NestJS service tests within this codebase.

## Key Findings

### 1. Redis Client Mocking Pattern (Most Relevant)

**File Reference**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/campaign-context.service.test.ts`

#### Setup Pattern:

```typescript
// Line 48-54: Mock provider for REDIS_CACHE token
{
  provide: REDIS_CACHE,
  useValue: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
},
```

#### Retrieval Pattern:

```typescript
// Line 84: Get the mock Redis client for assertions
redis = module.get(REDIS_CACHE);
```

#### Usage in Tests:

```typescript
// Mock return values
redis.get.mockResolvedValueOnce(null); // Cache miss
redis.setex.mockResolvedValue('OK'); // Set returns OK
redis.del.mockResolvedValue(1); // Delete returns count

// Make assertions
expect(redis.get).toHaveBeenCalledWith('campaign:context:campaign-1');
expect(redis.setex).toHaveBeenCalledWith(
  'campaign:context:campaign-1',
  60, // TTL
  expect.any(String)
);
expect(redis.del).toHaveBeenCalledWith('campaign:context:campaign-1');

// Verify call counts
expect(redis.get).toHaveBeenCalledTimes(2);
expect(redis.setex).toHaveBeenCalledTimes(1);
```

#### Error Handling Tests:

```typescript
// Test graceful degradation
redis.get.mockRejectedValue(new Error('Redis connection error'));
const context = await service.getCampaignContext(mockCampaignId, mockUser);
expect(context).toBeDefined(); // Service still works
expect(prisma.campaign.findFirst).toHaveBeenCalled(); // Falls back to DB
```

### 2. NestJS Service Testing Structure

**Pattern from condition.service.test.ts and campaign-context.service.test.ts**:

#### Module Setup:

```typescript
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ServiceUnderTest, // Actual service
      {
        provide: DependencyService,
        useValue: {
          method1: jest.fn(),
          method2: jest.fn(),
        },
      },
      {
        provide: INJECTION_TOKEN, // For @Inject() dependencies
        useValue: {
          method1: jest.fn(),
          method2: jest.fn(),
        },
      },
    ],
  }).compile();

  service = module.get<ServiceUnderTest>(ServiceUnderTest);
  dependency = module.get<DependencyService>(DependencyService);
  injected = module.get(INJECTION_TOKEN); // Get by token, not type
});
```

#### Key Points:

- Use `Test.createTestingModule()` from `@nestjs/testing`
- Two ways to mock:
  - **Class-based services**: `provide: ServiceClass, useValue: { methods... }`
  - **Token-based (like REDIS_CACHE)**: `provide: TOKEN, useValue: { methods... }`
- Retrieve with `module.get<Type>(Type)` or `module.get(TOKEN)`

### 3. Mock Creation Patterns

#### Three Approaches Used in Codebase:

**A) Manual Mock Objects (Preferred for Token-based)**

```typescript
{
  provide: REDIS_CACHE,
  useValue: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
  },
}
```

- Most common for injected tokens
- Clean, explicit, easy to read
- Best for methods with specific signatures

**B) jest.Mocked Type Annotation**

```typescript
let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock };
// or
let partyService: jest.Mocked<PartyService>;
```

- Provides TypeScript type safety
- IDE autocomplete on mock methods
- Used alongside manual mocks

**C) jest.fn() for Individual Methods**

```typescript
const mockGet = jest.fn().mockResolvedValue(null);
const mockSet = jest.fn().mockResolvedValue('OK');
```

- Flexible for chaining multiple return values
- `.mockResolvedValueOnce()` for sequential calls
- `.mockRejectedValue()` for error scenarios

### 4. Async Method Mocking Patterns

**For Promise-returning methods (like Redis):**

```typescript
// Single resolved value
redis.get.mockResolvedValue(null); // Always return null
redis.get.mockResolvedValue('cached-value');

// Sequential different values (cache miss then hit)
redis.get
  .mockResolvedValueOnce(null) // First call: cache miss
  .mockResolvedValueOnce('cached-value'); // Second call: cache hit

// Throw error
redis.get.mockRejectedValue(new Error('Redis error'));

// Custom implementation
redis.get.mockImplementation(async (key) => {
  if (key === 'special') return 'special-value';
  return null;
});
```

### 5. Verification Patterns

```typescript
// Basic call verification
expect(redis.get).toHaveBeenCalled();
expect(redis.get).toHaveBeenCalledTimes(2);

// Verify arguments
expect(redis.get).toHaveBeenCalledWith('key-name');

// Nth call verification
expect(redis.setex).toHaveBeenNthCalledWith(1, 'key1', 60, 'value');
expect(redis.setex).toHaveBeenNthCalledWith(2, 'key2', 300, 'value2');

// Clear between tests
jest.clearAllMocks(); // In afterEach()

// Partial argument matching
expect(redis.setex).toHaveBeenCalledWith(
  expect.any(String), // Any key
  60, // Exact TTL
  expect.any(String) // Any serialized value
);
```

### 6. CacheService-Specific Patterns

**For CacheService tests specifically**, you'll need to mock REDIS_CACHE with these methods:

```typescript
{
  provide: REDIS_CACHE,
  useValue: {
    // Basic operations
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),

    // Pattern operations
    scan: jest.fn(),
  },
}
```

**SCAN method for pattern deletion** (used in `delPattern`):

```typescript
// SCAN returns [nextCursor, keys]
redis.scan.mockResolvedValue(['0', ['key1', 'key2']]); // All keys in one scan

// Or simulated pagination
redis.scan
  .mockResolvedValueOnce(['1', ['key1', 'key2']]) // First page
  .mockResolvedValueOnce(['0', ['key3', 'key4']]); // Last page (cursor=0)
```

### 7. Test Structure Best Practices (From Codebase)

```typescript
describe('CacheService', () => {
  let service: CacheService;
  let redis: { get: jest.Mock; setex: jest.Mock; del: jest.Mock; scan: jest.Mock };

  beforeEach(async () => {
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
    it('should return cached value on hit', async () => {
      // Arrange
      redis.get.mockResolvedValue(JSON.stringify({ id: '123', name: 'Test' }));

      // Act
      const result = await service.get<{ id: string; name: string }>('test-key');

      // Assert
      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(redis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null on cache miss', async () => {
      // Arrange
      redis.get.mockResolvedValue(null);

      // Act
      const result = await service.get('nonexistent-key');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle parse errors gracefully', async () => {
      // Arrange
      redis.get.mockResolvedValue('invalid-json-{');

      // Act
      const result = await service.get('bad-key');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      // Arrange
      redis.get.mockRejectedValue(new Error('Connection failed'));

      // Act
      const result = await service.get('test-key');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should store value with default TTL', async () => {
      // Arrange
      redis.setex.mockResolvedValue('OK');
      const data = { id: '123' };

      // Act
      await service.set('test-key', data);

      // Assert
      expect(redis.setex).toHaveBeenCalledWith(
        'test-key',
        300, // Default TTL
        JSON.stringify(data)
      );
    });

    it('should store value with custom TTL', async () => {
      // Arrange
      redis.setex.mockResolvedValue('OK');
      const data = { id: '123' };

      // Act
      await service.set('test-key', data, { ttl: 600 });

      // Assert
      expect(redis.setex).toHaveBeenCalledWith(
        'test-key',
        600, // Custom TTL
        JSON.stringify(data)
      );
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      // Arrange
      redis.scan.mockResolvedValueOnce(['0', ['key1', 'key2', 'key3']]);
      redis.del.mockResolvedValue(3);

      // Act
      const result = await service.delPattern('test-*');

      // Assert
      expect(result).toEqual({ success: true, keysDeleted: 3 });
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'test-*', 'COUNT', 100);
      expect(redis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
    });

    it('should handle pagination with SCAN cursor', async () => {
      // Arrange
      redis.scan
        .mockResolvedValueOnce(['1', ['key1', 'key2']]) // First page
        .mockResolvedValueOnce(['0', ['key3']]); // Last page (cursor=0)
      redis.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      // Act
      const result = await service.delPattern('test-*');

      // Assert
      expect(result).toEqual({ success: true, keysDeleted: 3 });
      expect(redis.scan).toHaveBeenCalledTimes(2);
    });
  });
});
```

### 8. @Inject() Decorator Pattern

**How CacheService injects Redis:**

```typescript
// In cache.service.ts
constructor(@Inject(REDIS_CACHE) private readonly redis: Redis) {
  // ...
}
```

**In tests, use the same token:**

```typescript
{
  provide: REDIS_CACHE,  // Same token from @Inject(REDIS_CACHE)
  useValue: { /* mocks */ },
}
```

### 9. Environment Variables in Tests

**CacheService loads defaults from env vars:**

```typescript
// In cache.service.ts
this.defaultTtl = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10);
this.metricsEnabled = process.env.CACHE_METRICS_ENABLED !== 'false';
this.loggingEnabled = process.env.CACHE_LOGGING_ENABLED === 'true';
```

**In tests, these still apply unless you mock the constructor:**

```typescript
// Tests will use defaults (300s TTL, metrics on, logging off)
// To override, set before service creation:
process.env.CACHE_DEFAULT_TTL = '600';
```

---

## Summary Table

| Aspect           | Pattern                                         | Example                          |
| ---------------- | ----------------------------------------------- | -------------------------------- |
| **Token Mock**   | `provide: REDIS_CACHE, useValue: {...}`         | See section 1                    |
| **Retrieval**    | `module.get(REDIS_CACHE)`                       | Line 84 of campaign-context test |
| **Async Mock**   | `.mockResolvedValue()` / `.mockRejectedValue()` | Line 94                          |
| **Sequential**   | `.mockResolvedValueOnce()` chaining             | Line 454-465                     |
| **Verification** | `expect(redis.method).toHaveBeenCalledWith()`   | Line 494-498                     |
| **Error Test**   | `.mockRejectedValue(new Error())`               | Line 511                         |
| **SCAN Pattern** | Returns `[cursor, keys[]]` tuple                | Line 210 in cache.service.ts     |

---

## Files to Reference

- **Redis Mocking Example**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/campaign-context.service.test.ts`
- **NestJS Service Test Pattern**: `/storage/programs/campaign_manager/packages/api/src/graphql/services/condition.service.test.ts`
- **Service Under Test**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.service.ts`
- **Module Setup**: `/storage/programs/campaign_manager/packages/api/src/common/cache/cache.module.ts`
- **Redis Provider**: `/storage/programs/campaign_manager/packages/api/src/graphql/cache/redis-cache.provider.ts`
