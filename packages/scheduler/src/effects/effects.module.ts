/**
 * Effects Module
 * Provides services for managing deferred effect execution
 */

import { Module, forwardRef } from '@nestjs/common';

import { ApiModule } from '../api/api.module';
import { ConfigModule } from '../config/config.module';
import { QueueModule } from '../queue/queue.module';

import { DeferredEffectService } from './deferred-effect.service';

@Module({
  imports: [forwardRef(() => QueueModule), ApiModule, ConfigModule],
  providers: [DeferredEffectService],
  exports: [DeferredEffectService],
})
export class EffectsModule {}
