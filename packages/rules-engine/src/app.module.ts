import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RulesEngineController } from './controllers/rules-engine.controller';
import { GrpcLoggingInterceptor } from './interceptors/grpc-logging.interceptor';
import { EvaluationEngineService } from './services/evaluation-engine.service';

/**
 * Root module for the Rules Engine Worker Service
 *
 * This service is responsible for:
 * - Evaluating conditions using JSONLogic expressions (Stage 3: implemented)
 * - Maintaining dependency graphs per campaign/branch (Stage 4: planned)
 * - Performing incremental recomputation on state changes (Stage 4: planned)
 * - Caching evaluation results (Stage 5: planned)
 * - Communicating via gRPC and Redis pub/sub (Stage 6: planned)
 */
@Module({
  imports: [],
  providers: [
    EvaluationEngineService,
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcLoggingInterceptor,
    },
  ],
  controllers: [RulesEngineController],
})
export class AppModule {}
