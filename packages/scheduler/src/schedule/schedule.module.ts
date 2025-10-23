import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { QueueModule } from '../queue/queue.module';

import { ScheduleService } from './schedule.service';

/**
 * Module for cron-based scheduling.
 * Registers the ScheduleService and its dependencies.
 */
@Module({
  imports: [ConfigModule, QueueModule],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
