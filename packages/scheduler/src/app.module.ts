import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { HealthModule } from './health/health.module';
import { LoggerModule } from './logger/logger.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { QueueModule } from './queue/queue.module';
import { RedisSubscriberModule } from './redis/redis-subscriber.module';
import { ScheduleModule } from './schedule/schedule.module';
import { SettlementModule } from './settlements/settlement.module';
import { StructureModule } from './structures/structure.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    MonitoringModule,
    // Configure Bull with Redis connection
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        url: configService.redisUrl,
      }),
      inject: [ConfigService],
    }),
    // Enable cron scheduling
    NestScheduleModule.forRoot(),
    HealthModule,
    QueueModule,
    ScheduleModule,
    SettlementModule,
    StructureModule,
    // Redis pub/sub for real-time reactivity
    RedisSubscriberModule,
  ],
})
export class AppModule {}
