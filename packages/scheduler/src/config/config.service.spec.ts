import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;

  describe('with valid configuration', () => {
    beforeEach(async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.API_URL = 'http://localhost:9264/graphql';
      process.env.API_SERVICE_ACCOUNT_TOKEN = 'test-token';
      process.env.NODE_ENV = 'test';
      process.env.PORT = '9266';
      process.env.LOG_LEVEL = 'debug';

      const module: TestingModule = await Test.createTestingModule({
        imports: [NestConfigModule.forRoot()],
        providers: [ConfigService],
      }).compile();

      service = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
      delete process.env.REDIS_URL;
      delete process.env.API_URL;
      delete process.env.API_SERVICE_ACCOUNT_TOKEN;
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should return correct node environment', () => {
      expect(service.nodeEnv).toBe('test');
    });

    it('should return correct port', () => {
      expect(service.port).toBe(9266);
    });

    it('should return correct log level', () => {
      expect(service.logLevel).toBe('debug');
    });

    it('should return correct Redis URL', () => {
      expect(service.redisUrl).toBe('redis://localhost:6379');
    });

    it('should return correct API URL', () => {
      expect(service.apiUrl).toBe('http://localhost:9264/graphql');
    });

    it('should return correct API service account token', () => {
      expect(service.apiServiceAccountToken).toBe('test-token');
    });

    it('should return correct cron event expiration schedule', () => {
      expect(service.cronEventExpiration).toBe('*/5 * * * *');
    });

    it('should return correct cron settlement growth schedule', () => {
      expect(service.cronSettlementGrowth).toBe('0 * * * *');
    });

    it('should return correct cron structure maintenance schedule', () => {
      expect(service.cronStructureMaintenance).toBe('0 * * * *');
    });

    it('should return correct queue max retries', () => {
      expect(service.queueMaxRetries).toBe(3);
    });

    it('should return correct queue retry backoff', () => {
      expect(service.queueRetryBackoffMs).toBe(5000);
    });

    it('should return correct queue concurrency', () => {
      expect(service.queueConcurrency).toBe(5);
    });

    it('should return correct API request timeout', () => {
      expect(service.apiRequestTimeoutMs).toBe(10000);
    });

    it('should return correct API circuit breaker threshold', () => {
      expect(service.apiCircuitBreakerThreshold).toBe(5);
    });

    it('should return correct API circuit breaker duration', () => {
      expect(service.apiCircuitBreakerDurationMs).toBe(30000);
    });

    it('should detect test environment correctly', () => {
      expect(service.isTest).toBe(true);
      expect(service.isDevelopment).toBe(false);
      expect(service.isProduction).toBe(false);
    });
  });

  describe('with custom configuration', () => {
    beforeEach(async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.API_URL = 'http://localhost:9264/graphql';
      process.env.API_SERVICE_ACCOUNT_TOKEN = 'test-token';
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'error';
      process.env.CRON_EVENT_EXPIRATION = '*/10 * * * *';
      process.env.CRON_SETTLEMENT_GROWTH = '0 */2 * * *';
      process.env.CRON_STRUCTURE_MAINTENANCE = '0 0 * * *';
      process.env.QUEUE_MAX_RETRIES = '5';
      process.env.QUEUE_RETRY_BACKOFF_MS = '10000';
      process.env.QUEUE_CONCURRENCY = '10';
      process.env.API_REQUEST_TIMEOUT_MS = '20000';
      process.env.API_CIRCUIT_BREAKER_THRESHOLD = '10';
      process.env.API_CIRCUIT_BREAKER_DURATION_MS = '60000';

      const module: TestingModule = await Test.createTestingModule({
        imports: [NestConfigModule.forRoot()],
        providers: [ConfigService],
      }).compile();

      service = module.get<ConfigService>(ConfigService);
    });

    afterEach(() => {
      delete process.env.REDIS_URL;
      delete process.env.API_URL;
      delete process.env.API_SERVICE_ACCOUNT_TOKEN;
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;
      delete process.env.CRON_EVENT_EXPIRATION;
      delete process.env.CRON_SETTLEMENT_GROWTH;
      delete process.env.CRON_STRUCTURE_MAINTENANCE;
      delete process.env.QUEUE_MAX_RETRIES;
      delete process.env.QUEUE_RETRY_BACKOFF_MS;
      delete process.env.QUEUE_CONCURRENCY;
      delete process.env.API_REQUEST_TIMEOUT_MS;
      delete process.env.API_CIRCUIT_BREAKER_THRESHOLD;
      delete process.env.API_CIRCUIT_BREAKER_DURATION_MS;
    });

    it('should use custom port', () => {
      expect(service.port).toBe(8080);
    });

    it('should use custom log level', () => {
      expect(service.logLevel).toBe('error');
    });

    it('should use custom cron schedules', () => {
      expect(service.cronEventExpiration).toBe('*/10 * * * *');
      expect(service.cronSettlementGrowth).toBe('0 */2 * * *');
      expect(service.cronStructureMaintenance).toBe('0 0 * * *');
    });

    it('should use custom queue configuration', () => {
      expect(service.queueMaxRetries).toBe(5);
      expect(service.queueRetryBackoffMs).toBe(10000);
      expect(service.queueConcurrency).toBe(10);
    });

    it('should use custom API client configuration', () => {
      expect(service.apiRequestTimeoutMs).toBe(20000);
      expect(service.apiCircuitBreakerThreshold).toBe(10);
      expect(service.apiCircuitBreakerDurationMs).toBe(60000);
    });

    it('should detect production environment correctly', () => {
      expect(service.isProduction).toBe(true);
      expect(service.isDevelopment).toBe(false);
      expect(service.isTest).toBe(false);
    });

    it('should provide generic get method for all config values', () => {
      expect(service.get('NODE_ENV')).toBe('production');
      expect(service.get('PORT')).toBe(8080);
      expect(service.get('LOG_LEVEL')).toBe('error');
      expect(service.get('REDIS_URL')).toBe('redis://localhost:6379');
      expect(service.get('API_URL')).toBe('http://localhost:9264/graphql');
      expect(service.get('API_SERVICE_ACCOUNT_TOKEN')).toBe('test-token');
      expect(service.get('CRON_EVENT_EXPIRATION')).toBe('*/10 * * * *');
      expect(service.get('CRON_SETTLEMENT_GROWTH')).toBe('0 */2 * * *');
      expect(service.get('CRON_STRUCTURE_MAINTENANCE')).toBe('0 0 * * *');
      expect(service.get('QUEUE_MAX_RETRIES')).toBe(5);
      expect(service.get('QUEUE_RETRY_BACKOFF_MS')).toBe(10000);
      expect(service.get('QUEUE_CONCURRENCY')).toBe(10);
      expect(service.get('API_REQUEST_TIMEOUT_MS')).toBe(20000);
      expect(service.get('API_CIRCUIT_BREAKER_THRESHOLD')).toBe(10);
      expect(service.get('API_CIRCUIT_BREAKER_DURATION_MS')).toBe(60000);
    });

    it('should throw error for unknown configuration key', () => {
      expect(() => service.get('UNKNOWN_KEY')).toThrow('Unknown configuration key: UNKNOWN_KEY');
    });
  });

  describe('with missing required configuration', () => {
    it('should throw error when REDIS_URL is missing', async () => {
      delete process.env.REDIS_URL;
      process.env.API_URL = 'http://localhost:9264/graphql';
      process.env.API_SERVICE_ACCOUNT_TOKEN = 'test-token';

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [NestConfigModule.forRoot()],
          providers: [ConfigService],
        }).compile();

        module.get<ConfigService>(ConfigService);
      }).rejects.toThrow('Missing required environment variables: REDIS_URL');
    });

    it('should throw error when API_URL is missing', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      delete process.env.API_URL;
      process.env.API_SERVICE_ACCOUNT_TOKEN = 'test-token';

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [NestConfigModule.forRoot()],
          providers: [ConfigService],
        }).compile();

        module.get<ConfigService>(ConfigService);
      }).rejects.toThrow('Missing required environment variables: API_URL');
    });

    it('should throw error when API_SERVICE_ACCOUNT_TOKEN is missing', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.API_URL = 'http://localhost:9264/graphql';
      delete process.env.API_SERVICE_ACCOUNT_TOKEN;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [NestConfigModule.forRoot()],
          providers: [ConfigService],
        }).compile();

        module.get<ConfigService>(ConfigService);
      }).rejects.toThrow('Missing required environment variables: API_SERVICE_ACCOUNT_TOKEN');
    });

    it('should throw error when multiple required variables are missing', async () => {
      delete process.env.REDIS_URL;
      delete process.env.API_URL;
      delete process.env.API_SERVICE_ACCOUNT_TOKEN;

      await expect(async () => {
        const module: TestingModule = await Test.createTestingModule({
          imports: [NestConfigModule.forRoot()],
          providers: [ConfigService],
        }).compile();

        module.get<ConfigService>(ConfigService);
      }).rejects.toThrow(
        'Missing required environment variables: REDIS_URL, API_URL, API_SERVICE_ACCOUNT_TOKEN'
      );
    });
  });
});
