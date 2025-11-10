/**
 * @fileoverview gRPC client service for Rules Engine worker communication.
 *
 * This service provides a type-safe interface to the Rules Engine worker microservice,
 * which performs high-performance condition evaluation using JSONLogic. The client
 * implements resilience patterns including circuit breaker, automatic reconnection,
 * and graceful degradation when the worker is unavailable.
 *
 * Key Features:
 * - Automatic gRPC connection management with reconnection
 * - Circuit breaker pattern for handling worker failures
 * - Type-safe wrappers around gRPC calls
 * - Request timeout handling
 * - Health checking and availability monitoring
 * - Local fallback capability when worker unavailable
 *
 * Environment Configuration:
 * - RULES_ENGINE_GRPC_HOST: Worker host address (default: localhost)
 * - RULES_ENGINE_GRPC_PORT: Worker port (default: 50051)
 * - RULES_ENGINE_TIMEOUT_MS: Request timeout in ms (default: 5000)
 * - RULES_ENGINE_ENABLED: Enable/disable worker calls (default: true)
 *
 * Circuit Breaker Behavior:
 * - CLOSED: Normal operation, requests allowed
 * - OPEN: Worker failing, reject requests immediately
 * - HALF_OPEN: Testing if worker recovered
 * - Opens after 5 consecutive failures
 * - Attempts reset after 30 seconds
 *
 * Usage Example:
 * ```typescript
 * // Evaluate a single condition
 * const result = await rulesEngineClient.evaluateCondition({
 *   conditionId: 'condition-123',
 *   logic: { '===': [{ var: 'level' }, 5] },
 *   context: { level: 5 }
 * });
 *
 * // Batch evaluate multiple conditions
 * const results = await rulesEngineClient.evaluateConditions({
 *   conditions: [...],
 *   context: { ... }
 * });
 *
 * // Check if worker is available
 * const available = await rulesEngineClient.isAvailable();
 * ```
 *
 * @module api/grpc
 * @see {@link packages/rules-engine} Rules Engine worker implementation
 * @see {@link docs/features/rules-engine-worker.md} Complete feature documentation
 */

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
 * gRPC client with dynamic methods added by proto loader.
 *
 * The proto loader dynamically adds methods to the client based on the
 * protobuf definition, so we use an index signature to allow any method name.
 *
 * @interface DynamicGrpcClient
 * @extends {Client}
 */
interface DynamicGrpcClient extends Client {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [methodName: string]: any;
}

/**
 * Circuit breaker states for resilience pattern.
 *
 * The circuit breaker protects the system from cascading failures when the
 * Rules Engine worker becomes unavailable or slow to respond.
 *
 * State Transitions:
 * - CLOSED → OPEN: After reaching failure threshold (5 failures)
 * - OPEN → HALF_OPEN: After reset timeout (30 seconds)
 * - HALF_OPEN → CLOSED: After successful request
 * - HALF_OPEN → OPEN: After failed request
 *
 * @enum {string}
 */
enum CircuitState {
  /** Normal operation - requests are allowed through */
  CLOSED = 'CLOSED',
  /** Worker is failing - reject requests immediately to prevent cascading failures */
  OPEN = 'OPEN',
  /** Testing if worker has recovered - allow one request through */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * gRPC client service for Rules Engine worker communication.
 *
 * This service manages the connection to the Rules Engine worker microservice
 * and provides type-safe methods for condition evaluation operations. It implements
 * resilience patterns including circuit breaker, automatic reconnection, and
 * graceful degradation when the worker is unavailable.
 *
 * Connection Management:
 * - Automatically connects on module initialization
 * - Reconnects on connection loss
 * - Gracefully closes on module destruction
 * - Allows API to start even if worker is unavailable
 *
 * Resilience Features:
 * - Circuit breaker prevents cascading failures
 * - Request timeouts prevent hanging operations
 * - Health checking for monitoring
 * - Failure count tracking for observability
 *
 * Configuration via Environment Variables:
 * - RULES_ENGINE_GRPC_HOST: Worker host (default: localhost)
 * - RULES_ENGINE_GRPC_PORT: Worker port (default: 50051)
 * - RULES_ENGINE_TIMEOUT_MS: Request timeout (default: 5000ms)
 * - RULES_ENGINE_ENABLED: Enable/disable worker (default: true)
 *
 * @class RulesEngineClientService
 * @implements {OnModuleInit}
 * @implements {OnModuleDestroy}
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

  /**
   * Creates an instance of RulesEngineClientService.
   *
   * Initializes the service with configuration from environment variables:
   * - RULES_ENGINE_ENABLED: Set to 'false' to disable worker integration
   * - RULES_ENGINE_GRPC_HOST: Worker host address
   * - RULES_ENGINE_GRPC_PORT: Worker port number
   * - RULES_ENGINE_TIMEOUT_MS: Request timeout in milliseconds
   *
   * @constructor
   */
  constructor() {
    this.enabled = process.env.RULES_ENGINE_ENABLED !== 'false';
    this.host = process.env.RULES_ENGINE_GRPC_HOST || 'localhost';
    this.port = parseInt(process.env.RULES_ENGINE_GRPC_PORT || '50051', 10);
    this.timeout = parseInt(process.env.RULES_ENGINE_TIMEOUT_MS || '5000', 10);
  }

  /**
   * Lifecycle hook called when the NestJS module is initialized.
   *
   * Attempts to connect to the Rules Engine worker. If the connection fails,
   * logs an error but allows the API to continue starting. This enables the
   * API to function even when the worker is temporarily unavailable.
   *
   * @async
   * @returns {Promise<void>}
   */
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

  /**
   * Lifecycle hook called when the NestJS module is being destroyed.
   *
   * Gracefully closes the gRPC client connection to the Rules Engine worker.
   * This ensures proper cleanup of resources and prevents connection leaks.
   *
   * @async
   * @returns {Promise<void>}
   */
  async onModuleDestroy() {
    if (this.client) {
      this.client.close();
      this.isConnected = false;
      this.logger.log('Rules Engine gRPC client closed');
    }
  }

  /**
   * Establishes connection to the Rules Engine gRPC server.
   *
   * Loads the protobuf definition, creates the gRPC client, and waits for
   * the connection to be ready. The client is configured with insecure
   * credentials for internal microservice communication.
   *
   * Connection Configuration:
   * - keepCase: false (converts proto field names to camelCase)
   * - longs: String (represents 64-bit integers as strings)
   * - enums: String (represents enum values as strings)
   * - defaults: true (applies default values from proto)
   * - oneofs: true (enables oneof field handling)
   *
   * @private
   * @async
   * @returns {Promise<void>}
   * @throws {Error} If proto file cannot be loaded or connection fails
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
   * Waits for the gRPC client to be ready to accept requests.
   *
   * Uses the gRPC client's waitForReady method with a 5-second deadline.
   * This ensures the connection is fully established before attempting to
   * make RPC calls.
   *
   * @private
   * @async
   * @returns {Promise<void>} Resolves when client is ready
   * @throws {Error} If client is not initialized
   * @throws {Error} If connection cannot be established within 5 seconds
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

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
   * Checks if the circuit breaker allows requests to be sent to the worker.
   *
   * Circuit Breaker Logic:
   * - CLOSED: Always allows requests
   * - OPEN: Rejects requests, but transitions to HALF_OPEN after reset timeout
   * - HALF_OPEN: Allows one request to test if worker recovered
   *
   * This prevents cascading failures by stopping requests to a failing worker
   * and periodically testing if it has recovered.
   *
   * @private
   * @returns {boolean} True if requests are allowed, false if circuit is open
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
   * Records a successful request for circuit breaker state management.
   *
   * Success Handling:
   * - HALF_OPEN → CLOSED: Worker has recovered, close the circuit
   * - CLOSED: Reset failure count to maintain healthy state
   *
   * @private
   * @returns {void}
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
   * Records a failed request for circuit breaker state management.
   *
   * Failure Handling:
   * - Increments failure count
   * - HALF_OPEN → OPEN: Worker still failing, reopen circuit
   * - CLOSED → OPEN: After reaching failure threshold (5), open circuit
   *
   * When the circuit opens, records the timestamp for reset timeout calculation.
   *
   * @private
   * @returns {void}
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
   * Makes a gRPC request to the Rules Engine worker with resilience patterns.
   *
   * This method implements several resilience features:
   * - Circuit breaker: Prevents requests when worker is failing
   * - Auto-reconnect: Reconnects if connection was lost
   * - Request timeout: Prevents hanging operations
   * - Failure tracking: Records success/failure for circuit breaker
   *
   * Request Flow:
   * 1. Check if worker integration is enabled
   * 2. Check circuit breaker state
   * 3. Reconnect if needed
   * 4. Make gRPC call with deadline
   * 5. Record success or failure
   *
   * @private
   * @async
   * @template TRequest - The request payload type
   * @template TResponse - The response payload type
   * @param {string} method - gRPC method name to call (e.g., 'evaluateCondition')
   * @param {TRequest} request - Request payload matching the method's input type
   * @returns {Promise<TResponse>} Response from the worker
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If gRPC call fails (connection, timeout, worker error)
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
   * Checks if the Rules Engine worker is available and healthy.
   *
   * Performs a health check by attempting to fetch cache statistics from
   * the worker. This is a lightweight operation that verifies the worker
   * is responding to requests.
   *
   * Health Check Failures:
   * - Worker integration disabled
   * - Circuit breaker is open
   * - Connection cannot be established
   * - Worker does not respond within timeout
   *
   * Use this method before making condition evaluation requests to determine
   * if local fallback should be used instead.
   *
   * @async
   * @returns {Promise<boolean>} True if worker is healthy and responding
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
   * Gets the current circuit breaker state for monitoring and observability.
   *
   * Returns circuit breaker diagnostics including:
   * - Current state (CLOSED, OPEN, or HALF_OPEN)
   * - Number of consecutive failures
   * - Connection status to worker
   *
   * Use this method to expose circuit breaker metrics to monitoring systems
   * or health check endpoints.
   *
   * @returns {Object} Circuit breaker state information
   * @returns {CircuitState} state - Current circuit breaker state
   * @returns {number} failureCount - Number of consecutive failures
   * @returns {boolean} isConnected - Whether gRPC client is connected
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
   * Evaluates a single condition using JSONLogic against provided context.
   *
   * Sends a condition evaluation request to the Rules Engine worker, which
   * uses the high-performance JSONLogic evaluator. The worker may cache
   * results for improved performance on repeated evaluations.
   *
   * Request Structure:
   * - conditionId: Unique identifier for the condition (used for caching)
   * - logic: JSONLogic expression (e.g., { '===': [{ var: 'level' }, 5] })
   * - context: Data context for variable resolution (e.g., { level: 5 })
   *
   * Response Structure:
   * - result: Boolean evaluation result
   * - cached: Whether result was served from cache
   * - evaluationTimeMs: Time taken to evaluate (for performance monitoring)
   *
   * @async
   * @param {EvaluateConditionRequest} request - Condition evaluation request
   * @returns {Promise<EvaluationResult>} Evaluation result with metadata
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If worker fails to evaluate condition
   *
   * @example
   * ```typescript
   * const result = await client.evaluateCondition({
   *   conditionId: 'quest-completion',
   *   logic: { '>=': [{ var: 'questsCompleted' }, 10] },
   *   context: { questsCompleted: 12 }
   * });
   * // result: { result: true, cached: false, evaluationTimeMs: 2.5 }
   * ```
   */
  async evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult> {
    return this.makeRequest<EvaluateConditionRequest, EvaluationResult>(
      'evaluateCondition',
      request
    );
  }

  /**
   * Evaluates multiple conditions in batch for improved performance.
   *
   * Batch evaluation reduces network overhead and allows the worker to
   * optimize evaluation order and caching. Conditions are evaluated
   * respecting their dependency relationships.
   *
   * Request Structure:
   * - conditions: Array of condition objects with id, logic, and optional dependencies
   * - context: Shared data context for all conditions
   * - evaluationOrder: Optional pre-computed order (if null, worker computes it)
   *
   * Response Structure:
   * - results: Map of condition IDs to evaluation results
   * - evaluationOrder: Order in which conditions were evaluated
   * - totalTimeMs: Total time for batch evaluation
   * - cacheHitRate: Percentage of cached results
   *
   * Performance Benefits:
   * - Single network round-trip for multiple evaluations
   * - Worker can cache and reuse intermediate results
   * - Respects dependencies for correct evaluation order
   *
   * @async
   * @param {EvaluateConditionsRequest} request - Batch evaluation request
   * @returns {Promise<EvaluateConditionsResponse>} Batch evaluation results with metadata
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If worker fails to evaluate conditions
   *
   * @example
   * ```typescript
   * const response = await client.evaluateConditions({
   *   conditions: [
   *     { id: 'level-check', logic: { '>=': [{ var: 'level' }, 5] } },
   *     { id: 'quest-check', logic: { '===': [{ var: 'questComplete' }, true] } }
   *   ],
   *   context: { level: 7, questComplete: true }
   * });
   * // response.results: { 'level-check': true, 'quest-check': true }
   * ```
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
   * Computes the correct evaluation order for a set of dependent conditions.
   *
   * Uses topological sorting to determine the order in which conditions must
   * be evaluated to respect their dependencies. This is critical for conditions
   * that reference the results of other conditions.
   *
   * Request Structure:
   * - conditions: Array of condition objects with id and dependencies
   *
   * Response Structure:
   * - order: Array of condition IDs in evaluation order
   * - cycles: Array of detected circular dependencies (empty if valid)
   *
   * Dependency Resolution:
   * - Conditions with no dependencies are evaluated first
   * - Dependent conditions are evaluated after their dependencies
   * - Circular dependencies are detected and reported
   *
   * @async
   * @param {GetEvaluationOrderRequest} request - Evaluation order request
   * @returns {Promise<EvaluationOrderResponse>} Computed evaluation order
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If worker fails to compute order
   *
   * @example
   * ```typescript
   * const response = await client.getEvaluationOrder({
   *   conditions: [
   *     { id: 'a', dependencies: [] },
   *     { id: 'b', dependencies: ['a'] },
   *     { id: 'c', dependencies: ['a', 'b'] }
   *   ]
   * });
   * // response.order: ['a', 'b', 'c']
   * // response.cycles: []
   * ```
   */
  async getEvaluationOrder(request: GetEvaluationOrderRequest): Promise<EvaluationOrderResponse> {
    return this.makeRequest<GetEvaluationOrderRequest, EvaluationOrderResponse>(
      'getEvaluationOrder',
      request
    );
  }

  /**
   * Validates a dependency graph for circular dependencies and other issues.
   *
   * Analyzes the dependency relationships between conditions to detect:
   * - Circular dependencies (A depends on B, B depends on A)
   * - Missing dependencies (referenced condition doesn't exist)
   * - Self-dependencies (condition depends on itself)
   *
   * Request Structure:
   * - conditions: Array of condition objects with id and dependencies
   *
   * Response Structure:
   * - valid: Boolean indicating if graph is valid
   * - cycles: Array of detected circular dependency paths
   * - missingDependencies: Array of referenced but non-existent condition IDs
   *
   * Use Cases:
   * - Validate condition setup before creating computed fields
   * - Detect configuration errors early
   * - Provide user-friendly error messages for dependency issues
   *
   * @async
   * @param {ValidateDependenciesRequest} request - Dependency validation request
   * @returns {Promise<ValidationResult>} Validation result with detected issues
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If worker fails to validate dependencies
   *
   * @example
   * ```typescript
   * const result = await client.validateDependencies({
   *   conditions: [
   *     { id: 'a', dependencies: ['b'] },
   *     { id: 'b', dependencies: ['a'] }  // Circular!
   *   ]
   * });
   * // result: { valid: false, cycles: [['a', 'b']], missingDependencies: [] }
   * ```
   */
  async validateDependencies(request: ValidateDependenciesRequest): Promise<ValidationResult> {
    return this.makeRequest<ValidateDependenciesRequest, ValidationResult>(
      'validateDependencies',
      request
    );
  }

  /**
   * Invalidates cache entries in the Rules Engine worker.
   *
   * The worker caches condition evaluation results for performance. When the
   * underlying data changes, caches must be invalidated to ensure fresh
   * evaluations. This method allows selective or complete cache invalidation.
   *
   * Request Structure:
   * - conditionIds: Array of condition IDs to invalidate (empty = invalidate all)
   * - invalidateAll: Boolean flag to clear entire cache
   *
   * Response Structure:
   * - invalidatedCount: Number of cache entries removed
   * - remainingCount: Number of cache entries still present
   *
   * Cache Invalidation Strategies:
   * - Selective: Invalidate specific conditions when their context changes
   * - Complete: Clear all caches after major data updates
   * - Automatic: Worker may auto-invalidate based on TTL or memory pressure
   *
   * When to Invalidate:
   * - After updating entity data that conditions depend on
   * - After modifying condition logic
   * - After bulk data imports or migrations
   * - Periodically for cache freshness
   *
   * @async
   * @param {InvalidateCacheRequest} request - Cache invalidation request
   * @returns {Promise<InvalidateCacheResponse>} Invalidation result with counts
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If worker fails to invalidate cache
   *
   * @example
   * ```typescript
   * // Invalidate specific conditions
   * await client.invalidateCache({
   *   conditionIds: ['quest-complete', 'level-check']
   * });
   *
   * // Clear entire cache
   * await client.invalidateCache({
   *   invalidateAll: true
   * });
   * ```
   */
  async invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse> {
    return this.makeRequest<InvalidateCacheRequest, InvalidateCacheResponse>(
      'invalidateCache',
      request
    );
  }

  /**
   * Retrieves cache statistics from the Rules Engine worker.
   *
   * Returns metrics about the worker's cache performance for monitoring and
   * optimization. These statistics help understand cache effectiveness and
   * identify opportunities for performance improvements.
   *
   * Request Structure:
   * - Empty object (no parameters required)
   *
   * Response Structure:
   * - totalEntries: Total number of cached condition results
   * - hitRate: Percentage of cache hits vs total requests
   * - missRate: Percentage of cache misses vs total requests
   * - evictionCount: Number of entries evicted due to memory/TTL
   * - memoryUsage: Approximate cache memory usage in bytes
   * - oldestEntry: Timestamp of oldest cache entry
   *
   * Use Cases:
   * - Monitor cache effectiveness in production
   * - Tune cache size and TTL settings
   * - Detect cache-related performance issues
   * - Health checking (used by isAvailable method)
   *
   * Performance Indicators:
   * - High hit rate (>80%): Cache working well
   * - High eviction count: Consider increasing cache size
   * - Low hit rate: Conditions may not be reused, or TTL too short
   *
   * @async
   * @param {GetCacheStatsRequest} request - Cache stats request (empty object)
   * @returns {Promise<CacheStatsResponse>} Cache statistics and metrics
   * @throws {Error} If worker integration is disabled
   * @throws {Error} If circuit breaker is open
   * @throws {ServiceError} If worker fails to retrieve stats
   *
   * @example
   * ```typescript
   * const stats = await client.getCacheStats({});
   * console.log(`Cache hit rate: ${stats.hitRate}%`);
   * console.log(`Total entries: ${stats.totalEntries}`);
   * console.log(`Memory usage: ${stats.memoryUsage} bytes`);
   * ```
   */
  async getCacheStats(request: GetCacheStatsRequest): Promise<CacheStatsResponse> {
    return this.makeRequest<GetCacheStatsRequest, CacheStatsResponse>('getCacheStats', request);
  }
}
