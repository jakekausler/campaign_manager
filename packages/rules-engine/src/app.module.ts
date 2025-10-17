import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RulesEngineController } from './controllers/rules-engine.controller';
import { GrpcLoggingInterceptor } from './interceptors/grpc-logging.interceptor';
import { DependencyGraphBuilderService } from './services/dependency-graph-builder.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { EvaluationEngineService } from './services/evaluation-engine.service';

/**
 * Root module for the Rules Engine Worker Service
 *
 * This service is responsible for:
 * - Evaluating conditions using JSONLogic expressions (Stage 3: implemented)
 * - Maintaining dependency graphs per campaign/branch (Stage 4: implemented)
 * - Performing incremental recomputation on state changes (Stage 4: implemented)
 * - Caching evaluation results (Stage 5: planned)
 * - Communicating via gRPC and Redis pub/sub (Stage 6: planned)
 */
@Module({
  imports: [],
  providers: [
    DependencyGraphBuilderService,
    DependencyGraphService,
    EvaluationEngineService,
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcLoggingInterceptor,
    },
  ],
  controllers: [RulesEngineController],
})
export class AppModule {}
