import { join } from 'path';

import * as grpc from '@grpc/grpc-js';
import type { Client, GrpcObject, ServiceError } from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import type {
  EvaluateConditionRequest,
  EvaluateConditionsRequest,
  EvaluationResult,
  EvaluateConditionsResponse,
  GetEvaluationOrderRequest,
  EvaluationOrderResponse,
  ValidateDependenciesRequest,
  ValidationResult,
  InvalidateCacheRequest,
  InvalidateCacheResponse,
  GetCacheStatsRequest,
  CacheStatsResponse,
} from './rules-engine.types';

/**
 * gRPC client with dynamic methods added by proto loader
 */
interface DynamicGrpcClient extends Client {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [methodName: string]: any;
}

/**
 * Circuit breaker states for resilience pattern
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * gRPC client for Rules Engine worker service
 *
 * Provides:
 * - Connection management with automatic reconnection
 * - Circuit breaker pattern for resilience
 * - Type-safe wrappers around gRPC calls
 * - Graceful degradation when worker unavailable
 *
 * Configuration:
 * - RULES_ENGINE_GRPC_HOST: Worker host (default: localhost)
 * - RULES_ENGINE_GRPC_PORT: Worker port (default: 50051)
 * - RULES_ENGINE_TIMEOUT_MS: Request timeout (default: 5000)
 * - RULES_ENGINE_ENABLED: Enable/disable worker calls (default: true)
 */
@Injectable()
export class RulesEngineClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RulesEngineClientService.name);
  private client: DynamicGrpcClient | null = null; // gRPC client (dynamically loaded)
  private isConnected = false;
  private readonly enabled: boolean;
  private readonly host: string;
  private readonly port: number;
  private readonly timeout: number;

  // Circuit breaker configuration
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private readonly failureThreshold = 5; // Open circuit after N failures
  private readonly resetTimeout = 30000; // Try to reset after 30s
  private circuitOpenedAt?: number;

  constructor() {
    this.enabled = process.env.RULES_ENGINE_ENABLED !== 'false';
    this.host = process.env.RULES_ENGINE_GRPC_HOST || 'localhost';
    this.port = parseInt(process.env.RULES_ENGINE_GRPC_PORT || '50051', 10);
    this.timeout = parseInt(process.env.RULES_ENGINE_TIMEOUT_MS || '5000', 10);
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn('Rules Engine worker integration disabled via RULES_ENGINE_ENABLED=false');
      return;
    }

    try {
      await this.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Rules Engine worker on startup', error);
      // Don't throw - allow API to start even if worker is unavailable
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      this.client.close();
      this.isConnected = false;
      this.logger.log('Rules Engine gRPC client closed');
    }
  }

  /**
   * Connect to the gRPC server
   */
  private async connect(): Promise<void> {
    const protoPath = join(__dirname, '../../proto/rules-engine.proto');

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: false, // Convert to camelCase
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const proto: GrpcObject = grpc.loadPackageDefinition(packageDefinition);

    // Type assertion needed because GrpcObject index signature returns a union type
    const RulesEngineClient = (proto.rulesengine as GrpcObject).RulesEngine as new (
      address: string,
      credentials: grpc.ChannelCredentials
    ) => DynamicGrpcClient;

    this.client = new RulesEngineClient(
      `${this.host}:${this.port}`,
      grpc.credentials.createInsecure()
    );

    // Wait for connection to be ready
    await this.waitForReady();

    this.isConnected = true;
    this.logger.log(`Connected to Rules Engine worker at ${this.host}:${this.port}`);
  }

  /**
   * Wait for gRPC client to be ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.client.waitForReady(deadline, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if circuit breaker allows requests
   */
  private canMakeRequest(): boolean {
    if (this.circuitState === CircuitState.OPEN) {
      // Check if we should try to reset
      if (this.circuitOpenedAt && Date.now() - this.circuitOpenedAt > this.resetTimeout) {
        this.logger.log('Circuit breaker moving to HALF_OPEN state');
        this.circuitState = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Record successful request
   */
  private recordSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.logger.log('Circuit breaker closing after successful request');
      this.circuitState = CircuitState.CLOSED;
      this.failureCount = 0;
    } else if (this.circuitState === CircuitState.CLOSED) {
      this.failureCount = 0;
    }
  }

  /**
   * Record failed request
   */
  private recordFailure(): void {
    this.failureCount++;

    if (this.circuitState === CircuitState.HALF_OPEN) {
      this.logger.warn('Circuit breaker reopening after failure in HALF_OPEN state');
      this.circuitState = CircuitState.OPEN;
      this.circuitOpenedAt = Date.now();
    } else if (this.failureCount >= this.failureThreshold) {
      this.logger.warn(`Circuit breaker opening after ${this.failureCount} failures`);
      this.circuitState = CircuitState.OPEN;
      this.circuitOpenedAt = Date.now();
    }
  }

  /**
   * Make a gRPC call with circuit breaker and timeout
   */
  private async makeRequest<TRequest, TResponse>(
    method: string,
    request: TRequest
  ): Promise<TResponse> {
    if (!this.enabled) {
      throw new Error('Rules Engine worker integration is disabled');
    }

    if (!this.canMakeRequest()) {
      throw new Error('Circuit breaker is OPEN - worker may be unavailable');
    }

    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        this.recordFailure();
        throw error;
      }
    }

    return new Promise<TResponse>((resolve, reject) => {
      const deadline = new Date();
      deadline.setMilliseconds(deadline.getMilliseconds() + this.timeout);

      this.client![method](
        request,
        { deadline },
        (error: ServiceError | null, response: TResponse) => {
          if (error) {
            this.logger.error(`gRPC ${method} failed:`, error.message);
            this.recordFailure();
            reject(error);
          } else {
            this.recordSuccess();
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Check if the worker is available and healthy
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    if (!this.canMakeRequest()) {
      return false;
    }

    try {
      // Try a simple cache stats call as a health check
      await this.makeRequest<GetCacheStatsRequest, CacheStatsResponse>('getCacheStats', {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current circuit breaker state for monitoring
   */
  getCircuitState(): {
    state: CircuitState;
    failureCount: number;
    isConnected: boolean;
  } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      isConnected: this.isConnected,
    };
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult> {
    return this.makeRequest<EvaluateConditionRequest, EvaluationResult>(
      'evaluateCondition',
      request
    );
  }

  /**
   * Evaluate multiple conditions in batch
   */
  async evaluateConditions(
    request: EvaluateConditionsRequest
  ): Promise<EvaluateConditionsResponse> {
    return this.makeRequest<EvaluateConditionsRequest, EvaluateConditionsResponse>(
      'evaluateConditions',
      request
    );
  }

  /**
   * Get evaluation order for conditions
   */
  async getEvaluationOrder(request: GetEvaluationOrderRequest): Promise<EvaluationOrderResponse> {
    return this.makeRequest<GetEvaluationOrderRequest, EvaluationOrderResponse>(
      'getEvaluationOrder',
      request
    );
  }

  /**
   * Validate dependency graph for cycles
   */
  async validateDependencies(request: ValidateDependenciesRequest): Promise<ValidationResult> {
    return this.makeRequest<ValidateDependenciesRequest, ValidationResult>(
      'validateDependencies',
      request
    );
  }

  /**
   * Invalidate cache entries
   */
  async invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse> {
    return this.makeRequest<InvalidateCacheRequest, InvalidateCacheResponse>(
      'invalidateCache',
      request
    );
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(request: GetCacheStatsRequest): Promise<CacheStatsResponse> {
    return this.makeRequest<GetCacheStatsRequest, CacheStatsResponse>('getCacheStats', request);
  }
}
