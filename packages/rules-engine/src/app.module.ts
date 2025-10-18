import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { HealthController } from './controllers/health.controller';
import { RulesEngineController } from './controllers/rules-engine.controller';
import { GrpcLoggingInterceptor } from './interceptors/grpc-logging.interceptor';
import { CacheService } from './services/cache.service';
import { DependencyGraphBuilderService } from './services/dependency-graph-builder.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { EvaluationEngineService } from './services/evaluation-engine.service';
import { HealthService } from './services/health.service';
import { MetricsService } from './services/metrics.service';
import { RedisService } from './services/redis.service';

/**
 * Root module for the Rules Engine Worker Service
 *
 * This service is responsible for:
 * - Evaluating conditions using JSONLogic expressions (Stage 3: implemented)
 * - Maintaining dependency graphs per campaign/branch (Stage 4: implemented)
 * - Performing incremental recomputation on state changes (Stage 4: implemented)
 * - Caching evaluation results (Stage 5: implemented)
 * - Receiving invalidation events via Redis pub/sub (Stage 6: implemented)
 * - Providing health check endpoints for monitoring (Stage 8: implemented)
 */
@Module({
  imports: [],
  providers: [
    CacheService,
    DependencyGraphBuilderService,
    DependencyGraphService,
    EvaluationEngineService,
    HealthService,
    MetricsService,
    RedisService,
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcLoggingInterceptor,
    },
  ],
  controllers: [HealthController, RulesEngineController],
})
export class AppModule {}
