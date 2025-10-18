import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RulesEngineController } from './controllers/rules-engine.controller';
import { GrpcLoggingInterceptor } from './interceptors/grpc-logging.interceptor';
import { CacheService } from './services/cache.service';
import { DependencyGraphBuilderService } from './services/dependency-graph-builder.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { EvaluationEngineService } from './services/evaluation-engine.service';
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
 */
@Module({
  imports: [],
  providers: [
    CacheService,
    DependencyGraphBuilderService,
    DependencyGraphService,
    EvaluationEngineService,
    RedisService,
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcLoggingInterceptor,
    },
  ],
  controllers: [RulesEngineController],
})
export class AppModule {}
