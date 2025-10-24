import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { ApiModule } from '../api/api.module';
import { RedisSubscriberModule } from '../redis/redis-subscriber.module';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'health-check',
    }),
    ApiModule,
    RedisSubscriberModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
