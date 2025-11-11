import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bull';
import type { Express } from 'express';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

import { DeadLetterJob } from './dead-letter.service';
import { JobData } from './job.interface';
import { DEAD_LETTER_QUEUE, SCHEDULER_QUEUE } from './queue.constants';

/**
 * Module for Bull Board UI (development only).
 * Provides a web interface for monitoring job queues.
 * Only enabled when NODE_ENV is 'development'.
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: SCHEDULER_QUEUE,
    }),
    BullModule.registerQueue({
      name: DEAD_LETTER_QUEUE,
    }),
  ],
})
export class BullBoardModule implements OnModuleInit {
  private serverAdapter: ExpressAdapter | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(SCHEDULER_QUEUE) private readonly schedulerQueue: Queue<JobData>,
    @InjectQueue(DEAD_LETTER_QUEUE) private readonly deadLetterQueue: Queue<DeadLetterJob>
  ) {}

  async onModuleInit(): Promise<void> {
    // Only enable Bull Board in development
    if (this.configService.nodeEnv !== 'development') {
      return;
    }

    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullAdapter(this.schedulerQueue), new BullAdapter(this.deadLetterQueue)],
      serverAdapter: this.serverAdapter,
    });
  }

  /**
   * Get the Express adapter for Bull Board.
   * Should be mounted on the Express app.
   */
  getRouter(): Express | null {
    return this.serverAdapter?.getRouter() as Express | null;
  }
}
