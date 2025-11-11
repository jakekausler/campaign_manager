/**
 * API Client Service
 * Handles communication with the main API service via GraphQL
 * Authenticates using API key via x-api-key header
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpAgent, HttpsAgent } from 'agentkeepalive';
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
 * GraphQL query for fetching overdue events
 */
const GET_OVERDUE_EVENTS_QUERY = `
  query GetOverdueEvents($campaignId: ID!) {
    getOverdueEvents(campaignId: $campaignId) {
      id
      campaignId
      name
      eventType
      scheduledAt
      isCompleted
    }
  }
`;

/**
 * GraphQL query for fetching all campaign IDs
 */
const GET_ALL_CAMPAIGN_IDS_QUERY = `
  query GetAllCampaignIds {
    campaigns {
      id
    }
  }
`;

/**
 * GraphQL mutation for marking an event as expired
 */
const EXPIRE_EVENT_MUTATION = `
  mutation ExpireEvent($eventId: ID!) {
    expireEvent(eventId: $eventId) {
      id
      isCompleted
      occurredAt
    }
  }
`;

/**
 * GraphQL query for fetching settlements by campaign
 */
const GET_SETTLEMENTS_BY_CAMPAIGN_QUERY = `
  query GetSettlementsByCampaign($campaignId: ID!) {
    settlementsByCampaign(campaignId: $campaignId) {
      id
      campaignId
      kingdomId
      name
      level
      variables
    }
  }
`;

/**
 * GraphQL query for fetching structures by campaign
 */
const GET_STRUCTURES_BY_CAMPAIGN_QUERY = `
  query GetStructuresByCampaign($campaignId: ID!) {
    structuresByCampaign(campaignId: $campaignId) {
      id
      campaignId
      settlementId
      name
      type
      variables
    }
  }
`;

/**
 * GraphQL mutation for updating a settlement
 */
const UPDATE_SETTLEMENT_MUTATION = `
  mutation UpdateSettlement($id: ID!, $input: UpdateSettlementInput!) {
    updateSettlement(id: $id, input: $input) {
      id
      name
      level
      variables
      version
    }
  }
`;

/**
 * GraphQL mutation for updating a structure
 */
const UPDATE_STRUCTURE_MUTATION = `
  mutation UpdateStructure($id: ID!, $input: UpdateStructureInput!) {
    updateStructure(id: $id, input: $input) {
      id
      name
      type
      variables
      version
    }
  }
`;

/**
 * GraphQL mutation for completing an event
 */
const COMPLETE_EVENT_MUTATION = `
  mutation CompleteEvent($eventId: ID!, $occurredAt: DateTime) {
    completeEvent(eventId: $eventId, occurredAt: $occurredAt) {
      id
      isCompleted
      occurredAt
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
 * Event summary returned from the API
 */
export interface EventSummary {
  id: string;
  campaignId: string;
  name: string;
  eventType: string;
  scheduledAt: string;
  isCompleted: boolean;
}

/**
 * Expired event result from the API
 */
export interface ExpiredEventResult {
  id: string;
  isCompleted: boolean;
  occurredAt: string;
}

/**
 * Settlement summary from the API
 */
export interface SettlementSummary {
  id: string;
  campaignId: string;
  kingdomId: string;
  name: string;
  level: number;
  variables: Record<string, unknown>;
}

/**
 * Structure summary from the API
 */
export interface StructureSummary {
  id: string;
  campaignId: string;
  settlementId: string;
  name: string;
  type: string;
  variables: Record<string, unknown>;
}

/**
 * Settlement update input
 */
export interface UpdateSettlementInput {
  name?: string;
  level?: number;
  variables?: Record<string, unknown>;
  version?: number;
}

/**
 * Settlement update result
 */
export interface UpdateSettlementResult {
  id: string;
  name: string;
  level: number;
  variables: Record<string, unknown>;
  version: number;
}

/**
 * Structure update input
 */
export interface UpdateStructureInput {
  name?: string;
  type?: string;
  variables?: Record<string, unknown>;
  version?: number;
}

/**
 * Structure update result
 */
export interface UpdateStructureResult {
  id: string;
  name: string;
  type: string;
  variables: Record<string, unknown>;
  version: number;
}

/**
 * Complete event result
 */
export interface CompleteEventResult {
  id: string;
  isCompleted: boolean;
  occurredAt: string;
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
export class ApiClientService implements OnModuleDestroy {
  private readonly logger = new Logger(ApiClientService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly httpAgent: HttpAgent;
  private readonly httpsAgent: HttpsAgent;

  // Cache for frequently accessed data
  private readonly campaignCache = new Map<string, { data: string[]; timestamp: number }>();
  private readonly effectCache = new Map<string, { data: EffectDetails; timestamp: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    // Create connection pooling agents for HTTP/HTTPS
    // These agents reuse TCP connections for multiple requests
    this.httpAgent = new HttpAgent({
      keepAlive: true,
      maxSockets: 10, // Max concurrent connections per host
      maxFreeSockets: 5, // Max idle connections per host
      timeout: 60000, // Socket timeout (60s)
      freeSocketTimeout: 30000, // Idle socket timeout (30s)
    });

    this.httpsAgent = new HttpsAgent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 60000,
      freeSocketTimeout: 30000,
    });

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.configService.get('API_URL') as string,
      timeout: this.configService.get('API_REQUEST_TIMEOUT_MS') as number,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.configService.get('API_SERVICE_ACCOUNT_TOKEN') as string,
      },
      // Use connection pooling agents
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
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
   * Fetch effect details from the API (with caching)
   *
   * @param effectId - The effect ID to fetch
   * @returns Effect details
   */
  async getEffect(effectId: string): Promise<EffectDetails | null> {
    // Check cache first
    const cached = this.effectCache.get(effectId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.debug(`Returning cached effect ${effectId}`);
      return cached.data;
    }

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

      // Cache the result
      this.effectCache.set(effectId, {
        data: response.data.getEffect,
        timestamp: Date.now(),
      });

      // Clear expired cache entries periodically
      if (this.effectCache.size > 100) {
        this.clearExpiredCache();
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
   * Get overdue events for a campaign
   *
   * @param campaignId - The campaign ID
   * @returns Array of overdue event summaries
   */
  async getOverdueEvents(campaignId: string): Promise<EventSummary[]> {
    this.logger.debug(`Fetching overdue events for campaign ${campaignId}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: GET_OVERDUE_EVENTS_QUERY,
        variables: { campaignId },
      })) as GraphQLResponse<{ getOverdueEvents: EventSummary[] }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors fetching overdue events: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.getOverdueEvents) {
        this.logger.warn(`No overdue events found for campaign ${campaignId}`);
        return [];
      }

      const events = response.data.getOverdueEvents;
      this.logger.debug(`Found ${events.length} overdue event(s) for campaign ${campaignId}`);
      return events;
    } catch (error) {
      this.logger.error(
        `Failed to fetch overdue events for campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Get all campaign IDs (with caching)
   *
   * @returns Array of campaign IDs
   */
  async getAllCampaignIds(): Promise<string[]> {
    // Check cache first
    const cacheKey = 'all_campaigns';
    const cached = this.campaignCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      this.logger.debug('Returning cached campaign IDs');
      return cached.data;
    }

    this.logger.debug('Fetching all campaign IDs');

    try {
      const response = (await this.circuitBreaker.fire({
        query: GET_ALL_CAMPAIGN_IDS_QUERY,
      })) as GraphQLResponse<{ campaigns: Array<{ id: string }> }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors fetching campaign IDs: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.campaigns) {
        this.logger.warn('No campaigns found');
        return [];
      }

      const campaignIds = response.data.campaigns.map((c) => c.id);

      // Cache the result
      this.campaignCache.set(cacheKey, {
        data: campaignIds,
        timestamp: Date.now(),
      });

      this.logger.debug(`Found ${campaignIds.length} campaign(s)`);
      return campaignIds;
    } catch (error) {
      this.logger.error(
        `Failed to fetch campaign IDs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Mark an event as expired
   *
   * @param eventId - The event ID to expire
   * @returns Expired event result
   */
  async expireEvent(eventId: string): Promise<ExpiredEventResult> {
    this.logger.log(`Marking event ${eventId} as expired`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: EXPIRE_EVENT_MUTATION,
        variables: { eventId },
      })) as GraphQLResponse<{ expireEvent: ExpiredEventResult }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors expiring event ${eventId}: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.expireEvent) {
        throw new Error('No result returned from expireEvent mutation');
      }

      const result = response.data.expireEvent;
      this.logger.log(`Successfully expired event ${eventId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to expire event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`
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
   * Get settlements for a campaign
   *
   * @param campaignId - The campaign ID
   * @returns Array of settlement summaries
   */
  async getSettlementsByCampaign(campaignId: string): Promise<SettlementSummary[]> {
    this.logger.debug(`Fetching settlements for campaign ${campaignId}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: GET_SETTLEMENTS_BY_CAMPAIGN_QUERY,
        variables: { campaignId },
      })) as GraphQLResponse<{ settlementsByCampaign: SettlementSummary[] }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors fetching settlements: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.settlementsByCampaign) {
        this.logger.warn(`No settlements found for campaign ${campaignId}`);
        return [];
      }

      const settlements = response.data.settlementsByCampaign;
      this.logger.debug(`Found ${settlements.length} settlement(s) for campaign ${campaignId}`);
      return settlements;
    } catch (error) {
      this.logger.error(
        `Failed to fetch settlements for campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Get structures for a campaign
   *
   * @param campaignId - The campaign ID
   * @returns Array of structure summaries
   */
  async getStructuresByCampaign(campaignId: string): Promise<StructureSummary[]> {
    this.logger.debug(`Fetching structures for campaign ${campaignId}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: GET_STRUCTURES_BY_CAMPAIGN_QUERY,
        variables: { campaignId },
      })) as GraphQLResponse<{ structuresByCampaign: StructureSummary[] }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors fetching structures: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.structuresByCampaign) {
        this.logger.warn(`No structures found for campaign ${campaignId}`);
        return [];
      }

      const structures = response.data.structuresByCampaign;
      this.logger.debug(`Found ${structures.length} structure(s) for campaign ${campaignId}`);
      return structures;
    } catch (error) {
      this.logger.error(
        `Failed to fetch structures for campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Update a settlement
   *
   * @param id - Settlement ID
   * @param input - Update input
   * @returns Updated settlement
   */
  async updateSettlement(
    id: string,
    input: UpdateSettlementInput
  ): Promise<UpdateSettlementResult> {
    this.logger.log(`Updating settlement ${id}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: UPDATE_SETTLEMENT_MUTATION,
        variables: { id, input },
      })) as GraphQLResponse<{ updateSettlement: UpdateSettlementResult }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors updating settlement ${id}: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.updateSettlement) {
        throw new Error('No result returned from updateSettlement mutation');
      }

      const result = response.data.updateSettlement;
      this.logger.log(`Successfully updated settlement ${id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update settlement ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Update a structure
   *
   * @param id - Structure ID
   * @param input - Update input
   * @returns Updated structure
   */
  async updateStructure(id: string, input: UpdateStructureInput): Promise<UpdateStructureResult> {
    this.logger.log(`Updating structure ${id}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: UPDATE_STRUCTURE_MUTATION,
        variables: { id, input },
      })) as GraphQLResponse<{ updateStructure: UpdateStructureResult }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors updating structure ${id}: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.updateStructure) {
        throw new Error('No result returned from updateStructure mutation');
      }

      const result = response.data.updateStructure;
      this.logger.log(`Successfully updated structure ${id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update structure ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Complete an event (triggers effects execution)
   *
   * @param eventId - Event ID
   * @param occurredAt - Optional timestamp (defaults to current world time)
   * @returns Completed event result
   */
  async completeEvent(eventId: string, occurredAt?: string): Promise<CompleteEventResult> {
    this.logger.log(`Completing event ${eventId}${occurredAt ? ` at ${occurredAt}` : ''}`);

    try {
      const response = (await this.circuitBreaker.fire({
        query: COMPLETE_EVENT_MUTATION,
        variables: { eventId, ...(occurredAt && { occurredAt }) },
      })) as GraphQLResponse<{ completeEvent: CompleteEventResult }>;

      if (response.errors && response.errors.length > 0) {
        const errorMessage = response.errors.map((e: { message: string }) => e.message).join(', ');
        this.logger.error(`GraphQL errors completing event ${eventId}: ${errorMessage}`);
        throw new Error(`GraphQL errors: ${errorMessage}`);
      }

      if (!response.data?.completeEvent) {
        throw new Error('No result returned from completeEvent mutation');
      }

      const result = response.data.completeEvent;
      this.logger.log(`Successfully completed event ${eventId}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to complete event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();

    // Clear expired campaign cache entries
    for (const [key, value] of this.campaignCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.campaignCache.delete(key);
      }
    }

    // Clear expired effect cache entries
    for (const [key, value] of this.effectCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.effectCache.delete(key);
      }
    }
  }

  /**
   * Invalidate all caches
   */
  invalidateCache(): void {
    this.logger.debug('Invalidating all caches');
    this.campaignCache.clear();
    this.effectCache.clear();
  }

  /**
   * Invalidate effect cache for a specific effect
   *
   * @param effectId - Effect ID to invalidate
   */
  invalidateEffectCache(effectId: string): void {
    this.logger.debug(`Invalidating effect cache for ${effectId}`);
    this.effectCache.delete(effectId);
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

  /**
   * Cleanup resources on module destruction
   */
  onModuleDestroy() {
    this.logger.log('Cleaning up API client resources');
    // Destroy connection pooling agents
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }
}
