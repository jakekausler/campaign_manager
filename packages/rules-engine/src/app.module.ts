import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { RulesEngineController } from './controllers/rules-engine.controller';
import { GrpcLoggingInterceptor } from './interceptors/grpc-logging.interceptor';

/**
 * Root module for the Rules Engine Worker Service
 *
 * This service is responsible for:
 * - Evaluating conditions using JSONLogic expressions
 * - Maintaining dependency graphs per campaign/branch
 * - Performing incremental recomputation on state changes
 * - Caching evaluation results
 * - Communicating via gRPC and Redis pub/sub
 */
@Module({
  imports: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcLoggingInterceptor,
    },
  ],
  controllers: [RulesEngineController],
})
export class AppModule {}
