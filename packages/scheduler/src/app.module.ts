import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    ConfigModule,
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
  ],
})
export class AppModule {}
