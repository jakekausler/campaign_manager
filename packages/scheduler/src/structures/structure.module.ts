/**
 * Structure Module
 * Provides dependency injection for structure-related services
 */

import { Module, forwardRef } from '@nestjs/common';

import { ApiModule } from '../api/api.module';
import { QueueModule } from '../queue/queue.module';

import { StructureSchedulingService } from './structure-scheduling.service';

@Module({
  imports: [ApiModule, forwardRef(() => QueueModule)],
  providers: [StructureSchedulingService],
  exports: [StructureSchedulingService],
})
export class StructureModule {}
