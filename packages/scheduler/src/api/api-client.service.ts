/**
 * API Client Service
 * Handles communication with the main API service via GraphQL
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import CircuitBreaker from 'opossum';

import { ConfigService } from '../config/config.service';

/**
 * GraphQL query for fetching effect details
 */
const GET_EFFECT_QUERY = `
  query GetEffect($id: ID!) {
    getEffect(id: $id) {
      id
      campaignId
      name
      description
      entityType
      entityId
      timing
      jsonPatch
      isActive
      priority
    }
  }
`;

/**
 * GraphQL mutation for executing an effect
 */
const EXECUTE_EFFECT_MUTATION = `
  mutation ExecuteEffect($input: ExecuteEffectInput!) {
    executeEffect(input: $input) {
      success
      message
      execution {
        id
        effectId
        executedAt
        success
        error
      }
    }
  }
`;

/**
 * Effect details returned from the API
 */
export interface EffectDetails {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  entityType: string;
  entityId: string;
  timing: string;
  jsonPatch: unknown;
  isActive: boolean;
  priority: number;
}

/**
 * Effect execution result from the API
 */
export interface EffectExecutionResult {
  success: boolean;
  message?: string;
  execution?: {
    id: string;
    effectId: string;
    executedAt: string;
    success: boolean;
    error?: string;
  };
}

/**
 * GraphQL request body structure
 */
interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
}

/**
 * GraphQL response structure
 */
interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

@Injectable()
export class ApiClientService {
  private readonly logger = new Logger(ApiClientService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.configService.get('API_URL') as string,
      timeout: this.configService.get('API_REQUEST_TIMEOUT_MS') as number,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.configService.get('API_SERVICE_ACCOUNT_TOKEN')}`,
      },
    });

    // Create circuit breaker for API requests
    this.circuitBreaker = new CircuitBreaker(
      this.makeRequest.bind(this) as (...args: unknown[]) => Promise<unknown>,
      {
        timeout: this.configService.get('API_REQUEST_TIMEOUT_MS') as number,
        errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
        resetTimeout: this.configService.get('API_CIRCUIT_BREAKER_DURATION_MS') as number,
      }
    );

    // Log circuit breaker state changes
    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker opened - API is unavailable');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.warn('Circuit breaker half-open - testing API availability');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker closed - API is available');
    });
  }

  /**
   * Fetch effect details from the API
   *
   * @param effectId - The effect ID to fetch
   * @returns Effect details
   */
  async getEffect(effectId: string): Promise<EffectDetails | null> {
    this.logger.debug(`Fetching effect details for effect ${effectId}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: GET_EFFECT_QUERY,
        variables: { id: effectId },
      })) as GraphQLResponse<{ getEffect: EffectDetails | null }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors fetching effect ${effectId}: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.getEffect) {
        this.logger.warn(`Effect ${effectId} not found`);
        return null;
      }

      this.logger.debug(`Successfully fetched effect ${effectId}`);
      return response.data.getEffect;
    } catch (error) {
      this.logger.error(
        `Failed to fetch effect ${effectId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Execute an effect via the API
   *
   * @param effectId - The effect ID to execute
   * @param entityId - The entity to apply the effect to (optional, uses effect's entityId if not provided)
   * @returns Execution result
   */
  async executeEffect(effectId: string, entityId?: string): Promise<EffectExecutionResult> {
    this.logger.log(`Executing effect ${effectId}${entityId ? ` on entity ${entityId}` : ''}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: EXECUTE_EFFECT_MUTATION,
        variables: {
          input: {
            effectId,
            ...(entityId && { entityId }),
          },
        },
      })) as GraphQLResponse<{ executeEffect: EffectExecutionResult }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors executing effect ${effectId}: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.executeEffect) {
        throw new Error('No execution result returned from API');
      }

      const result = response.data.executeEffect;

      if (result.success) {
        this.logger.log(`Successfully executed effect ${effectId}`);
      } else {
        this.logger.warn(
          `Effect ${effectId} execution completed with errors: ${result.message || 'Unknown error'}`
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to execute effect ${effectId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Make a GraphQL request to the API
   *
   * @param request - GraphQL request body
   * @returns GraphQL response
   */
  private async makeRequest<T>(request: GraphQLRequest): Promise<GraphQLResponse<T>> {
    try {
      const response = await this.axiosInstance.post<GraphQLResponse<T>>('', request);
      return response.data;
    } catch (error) {
      // Handle axios errors
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          // Server responded with error status
          // Note: Avoid logging response.data as it may contain sensitive information
          this.logger.error(
            `API request failed with status ${axiosError.response.status}: ${axiosError.response.statusText || 'Unknown error'}`
          );
        } else if (axiosError.request) {
          // Request made but no response received
          this.logger.error('API request failed: No response received');
        } else {
          // Error setting up the request
          this.logger.error(`API request failed: ${axiosError.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Check if the circuit breaker is open (API is unavailable)
   *
   * @returns True if circuit breaker is open
   */
  isCircuitBreakerOpen(): boolean {
    return this.circuitBreaker.opened;
  }

  /**
   * Get circuit breaker statistics
   *
   * @returns Circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.stats;
  }
}
