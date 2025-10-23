import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { HealthModule } from './health/health.module';

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
    ScheduleModule.forRoot(),
    HealthModule,
  ],
})
export class AppModule {}
