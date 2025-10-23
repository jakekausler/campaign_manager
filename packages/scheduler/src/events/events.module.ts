import { Module } from '@nestjs/common';

import { ApiModule } from '../api/api.module';
import { ConfigModule } from '../config/config.module';

import { EventExpirationService } from './event-expiration.service';

/**
 * Events Module
 * Handles event-related scheduling operations (expiration, etc.)
 */
@Module({
  imports: [ApiModule, ConfigModule],
  providers: [EventExpirationService],
  exports: [EventExpirationService],
})
export class EventsModule {}
