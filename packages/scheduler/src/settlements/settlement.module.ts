/**
 * Settlement Module
 * Provides dependency injection for settlement-related services
 */

import { Module, forwardRef } from '@nestjs/common';

import { ApiModule } from '../api/api.module';
import { QueueModule } from '../queue/queue.module';

import { SettlementSchedulingService } from './settlement-scheduling.service';

@Module({
  imports: [ApiModule, forwardRef(() => QueueModule)],
  providers: [SettlementSchedulingService],
  exports: [SettlementSchedulingService],
})
export class SettlementModule {}
