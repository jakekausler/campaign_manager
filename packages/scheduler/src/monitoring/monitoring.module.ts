/**
 * Monitoring Module
 * Provides alerting and monitoring services
 */

import { Global, Module } from '@nestjs/common';

import { AlertingService } from './alerting.service';

@Global()
@Module({
  providers: [AlertingService],
  exports: [AlertingService],
})
export class MonitoringModule {}
