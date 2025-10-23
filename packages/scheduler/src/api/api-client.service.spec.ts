/**
 * API Client Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import CircuitBreaker from 'opossum';

import { ConfigService } from '../config/config.service';

import { ApiClientService, EffectDetails, EffectExecutionResult } from './api-client.service';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock opossum circuit breaker
jest.mock('opossum');
const MockedCircuitBreaker = CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>;

describe('ApiClientService', () => {
  let service: ApiClientService;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock CircuitBreaker instance
    mockCircuitBreaker = {
      fire: jest.fn(),
      on: jest.fn(),
      opened: false,
      stats: {},
    } as unknown as jest.Mocked<CircuitBreaker>;

    MockedCircuitBreaker.mockImplementation(() => mockCircuitBreaker);

    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      post: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    // Mock isAxiosError as a type predicate function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedAxios.isAxiosError = jest.fn(() => false) as any;

    // Create mock config service
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string | number> = {
          API_URL: 'http://localhost:9264/graphql',
          API_SERVICE_ACCOUNT_TOKEN: 'test-token',
          API_REQUEST_TIMEOUT_MS: 10000,
          API_CIRCUIT_BREAKER_DURATION_MS: 30000,
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiClientService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ApiClientService>(ApiClientService);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:9264/graphql',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      });
    });

    it('should create circuit breaker with correct configuration', () => {
      expect(MockedCircuitBreaker).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          timeout: 10000,
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
        })
      );
    });

    it('should register circuit breaker event listeners', () => {
      expect(mockCircuitBreaker.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockCircuitBreaker.on).toHaveBeenCalledWith('halfOpen', expect.any(Function));
      expect(mockCircuitBreaker.on).toHaveBeenCalledWith('close', expect.any(Function));
    });
  });

  describe('getEffect', () => {
    const mockEffect: EffectDetails = {
      id: 'effect-1',
      campaignId: 'campaign-1',
      name: 'Test Effect',
      description: 'Test description',
      entityType: 'Settlement',
      entityId: 'entity-1',
      timing: 'PRE',
      jsonPatch: [{ op: 'add', path: '/test', value: 123 }],
      isActive: true,
      priority: 5,
    };

    it('should fetch effect details successfully', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: { getEffect: mockEffect },
      });

      const result = await service.getEffect('effect-1');

      expect(result).toEqual(mockEffect);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith({
        query: expect.stringContaining('query GetEffect'),
        variables: { id: 'effect-1' },
      });
    });

    it('should return null if effect not found', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: { getEffect: null },
      });

      const result = await service.getEffect('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on GraphQL errors', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: null,
        errors: [{ message: 'Effect not found' }],
      });

      await expect(service.getEffect('effect-1')).rejects.toThrow(
        'GraphQL errors: Effect not found'
      );
    });

    it('should handle multiple GraphQL errors', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        errors: [{ message: 'Error 1' }, { message: 'Error 2' }],
      });

      await expect(service.getEffect('effect-1')).rejects.toThrow(
        'GraphQL errors: Error 1, Error 2'
      );
    });

    it('should handle circuit breaker failures', async () => {
      mockCircuitBreaker.fire.mockRejectedValue(new Error('Circuit breaker open'));

      await expect(service.getEffect('effect-1')).rejects.toThrow('Circuit breaker open');
    });
  });

  describe('executeEffect', () => {
    const mockExecutionResult: EffectExecutionResult = {
      success: true,
      message: 'Effect executed successfully',
      execution: {
        id: 'exec-1',
        effectId: 'effect-1',
        executedAt: '2023-10-01T12:00:00Z',
        success: true,
      },
    };

    it('should execute effect successfully', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: { executeEffect: mockExecutionResult },
      });

      const result = await service.executeEffect('effect-1');

      expect(result).toEqual(mockExecutionResult);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith({
        query: expect.stringContaining('mutation ExecuteEffect'),
        variables: {
          input: {
            effectId: 'effect-1',
          },
        },
      });
    });

    it('should execute effect with custom entity ID', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: { executeEffect: mockExecutionResult },
      });

      await service.executeEffect('effect-1', 'entity-2');

      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith({
        query: expect.stringContaining('mutation ExecuteEffect'),
        variables: {
          input: {
            effectId: 'effect-1',
            entityId: 'entity-2',
          },
        },
      });
    });

    it('should handle execution failures', async () => {
      const failureResult: EffectExecutionResult = {
        success: false,
        message: 'Effect execution failed',
        execution: {
          id: 'exec-1',
          effectId: 'effect-1',
          executedAt: '2023-10-01T12:00:00Z',
          success: false,
          error: 'Invalid patch operation',
        },
      };

      mockCircuitBreaker.fire.mockResolvedValue({
        data: { executeEffect: failureResult },
      });

      const result = await service.executeEffect('effect-1');

      expect(result).toEqual(failureResult);
      expect(result.success).toBe(false);
    });

    it('should throw error on GraphQL errors', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        errors: [{ message: 'Unauthorized' }],
      });

      await expect(service.executeEffect('effect-1')).rejects.toThrow(
        'GraphQL errors: Unauthorized'
      );
    });

    it('should throw error if no execution result returned', async () => {
      mockCircuitBreaker.fire.mockResolvedValue({
        data: { executeEffect: null },
      });

      await expect(service.executeEffect('effect-1')).rejects.toThrow(
        'No execution result returned from API'
      );
    });
  });

  describe('isCircuitBreakerOpen', () => {
    it('should return true when circuit breaker is open', () => {
      Object.defineProperty(mockCircuitBreaker, 'opened', {
        value: true,
        writable: true,
        configurable: true,
      });

      expect(service.isCircuitBreakerOpen()).toBe(true);
    });

    it('should return false when circuit breaker is closed', () => {
      Object.defineProperty(mockCircuitBreaker, 'opened', {
        value: false,
        writable: true,
        configurable: true,
      });

      expect(service.isCircuitBreakerOpen()).toBe(false);
    });
  });

  describe('getCircuitBreakerStats', () => {
    it('should return circuit breaker statistics', () => {
      const mockStats = {
        fires: 100,
        successes: 95,
        failures: 5,
        timeouts: 2,
      };
      Object.defineProperty(mockCircuitBreaker, 'stats', {
        value: mockStats,
        writable: true,
        configurable: true,
      });

      const stats = service.getCircuitBreakerStats();

      expect(stats).toEqual(mockStats);
    });
  });
});
