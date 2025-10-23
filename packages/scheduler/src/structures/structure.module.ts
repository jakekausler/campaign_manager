/**
 * Structure Module
 * Provides dependency injection for structure-related services
 */

import { Module } from '@nestjs/common';

import { ApiModule } from '../api/api.module';
import { QueueModule } from '../queue/queue.module';

import { StructureSchedulingService } from './structure-scheduling.service';

@Module({
  imports: [ApiModule, QueueModule],
  providers: [StructureSchedulingService],
  exports: [StructureSchedulingService],
})
export class StructureModule {}
