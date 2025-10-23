import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {
    this.validateConfig();
  }

  /**
   * Get the Node environment (development, production, test)
   */
  get nodeEnv(): string {
    return this.nestConfigService.get<string>('NODE_ENV', 'development');
  }

  /**
   * Get the service port
   */
  get port(): number {
    return parseInt(this.nestConfigService.get<string>('PORT', '9266'), 10);
  }

  /**
   * Get the log level (debug, info, warn, error)
   */
  get logLevel(): string {
    return this.nestConfigService.get<string>('LOG_LEVEL', 'info');
  }

  /**
   * Get the Redis URL
   */
  get redisUrl(): string {
    const url = this.nestConfigService.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('REDIS_URL environment variable is required');
    }
    return url;
  }

  /**
   * Get the API URL (GraphQL endpoint)
   */
  get apiUrl(): string {
    const url = this.nestConfigService.get<string>('API_URL');
    if (!url) {
      throw new Error('API_URL environment variable is required');
    }
    return url;
  }

  /**
   * Get the service account token for API authentication
   */
  get apiServiceAccountToken(): string {
    const token = this.nestConfigService.get<string>('API_SERVICE_ACCOUNT_TOKEN');
    if (!token) {
      throw new Error('API_SERVICE_ACCOUNT_TOKEN environment variable is required');
    }
    return token;
  }

  /**
   * Get cron schedule for event expiration checks
   */
  get cronEventExpiration(): string {
    return this.nestConfigService.get<string>('CRON_EVENT_EXPIRATION', '*/5 * * * *');
  }

  /**
   * Get cron schedule for settlement growth checks
   */
  get cronSettlementGrowth(): string {
    return this.nestConfigService.get<string>('CRON_SETTLEMENT_GROWTH', '0 * * * *');
  }

  /**
   * Get cron schedule for structure maintenance checks
   */
  get cronStructureMaintenance(): string {
    return this.nestConfigService.get<string>('CRON_STRUCTURE_MAINTENANCE', '0 * * * *');
  }

  /**
   * Get queue max retries
   */
  get queueMaxRetries(): number {
    return parseInt(this.nestConfigService.get<string>('QUEUE_MAX_RETRIES', '3'), 10);
  }

  /**
   * Get queue retry backoff in milliseconds
   */
  get queueRetryBackoffMs(): number {
    return parseInt(this.nestConfigService.get<string>('QUEUE_RETRY_BACKOFF_MS', '5000'), 10);
  }

  /**
   * Get queue concurrency (number of jobs processed in parallel)
   */
  get queueConcurrency(): number {
    return parseInt(this.nestConfigService.get<string>('QUEUE_CONCURRENCY', '5'), 10);
  }

  /**
   * Get API request timeout in milliseconds
   */
  get apiRequestTimeoutMs(): number {
    return parseInt(this.nestConfigService.get<string>('API_REQUEST_TIMEOUT_MS', '10000'), 10);
  }

  /**
   * Get API circuit breaker threshold (failures before opening)
   */
  get apiCircuitBreakerThreshold(): number {
    return parseInt(this.nestConfigService.get<string>('API_CIRCUIT_BREAKER_THRESHOLD', '5'), 10);
  }

  /**
   * Get API circuit breaker duration in milliseconds (how long to stay open)
   */
  get apiCircuitBreakerDurationMs(): number {
    return parseInt(
      this.nestConfigService.get<string>('API_CIRCUIT_BREAKER_DURATION_MS', '30000'),
      10
    );
  }

  /**
   * Check if running in development mode
   */
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  /**
   * Check if running in production mode
   */
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  /**
   * Check if running in test mode
   */
  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  /**
   * Validate that all required configuration is present
   */
  private validateConfig(): void {
    const requiredVars = ['REDIS_URL', 'API_URL', 'API_SERVICE_ACCOUNT_TOKEN'];

    const missing = requiredVars.filter((varName) => !this.nestConfigService.get(varName));

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
