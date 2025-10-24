/**
 * Redis Subscriber Module
 * Provides dependency injection for Redis pub/sub functionality
 */

import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { QueueModule } from '../queue/queue.module';
import { SettlementModule } from '../settlements/settlement.module';
import { StructureModule } from '../structures/structure.module';

import { RedisSubscriberService } from './redis-subscriber.service';

@Module({
  imports: [ConfigModule, QueueModule, SettlementModule, StructureModule],
  providers: [RedisSubscriberService],
  exports: [RedisSubscriberService],
})
export class RedisSubscriberModule {}
