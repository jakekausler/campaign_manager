import { Module } from '@nestjs/common';

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
  providers: [],
  controllers: [],
})
export class AppModule {}
