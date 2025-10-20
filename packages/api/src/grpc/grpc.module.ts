/**
 * gRPC Module
 * Provides gRPC client services for microservice communication
 */

import { Module } from '@nestjs/common';

import { RulesEngineClientService } from './rules-engine-client.service';

@Module({
  providers: [RulesEngineClientService],
  exports: [RulesEngineClientService],
})
export class GrpcModule {}
