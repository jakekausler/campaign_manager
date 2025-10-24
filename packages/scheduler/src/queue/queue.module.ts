import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { EffectsModule } from '../effects/effects.module';
import { EventsModule } from '../events/events.module';
import { HealthModule } from '../health/health.module';

import { BullBoardModule } from './bull-board.module';
import { DeadLetterService } from './dead-letter.service';
import { JobProcessorService } from './job-processor.service';
import { MetricsController } from './metrics.controller';
import { DEAD_LETTER_QUEUE, SCHEDULER_QUEUE } from './queue.constants';
import { QueueService } from './queue.service';

/**
 * Module for managing the scheduler job queue system.
 * Provides job queue infrastructure with Bull, including:
 * - Main scheduler queue for all job types
 * - Dead-letter queue for failed jobs
 * - Job processing with retry logic
 * - Queue metrics and monitoring
 * - Bull Board UI (development only)
 */
@Module({
  imports: [
    ConfigModule,
    // Register the main scheduler queue
    BullModule.registerQueue({
      name: SCHEDULER_QUEUE,
    }),
    // Register the dead-letter queue
    BullModule.registerQueue({
      name: DEAD_LETTER_QUEUE,
    }),
    BullBoardModule,
    EffectsModule,
    EventsModule,
    forwardRef(() => HealthModule),
  ],
  controllers: [MetricsController],
  providers: [QueueService, JobProcessorService, DeadLetterService],
  exports: [QueueService, DeadLetterService, BullBoardModule],
})
export class QueueModule {}
