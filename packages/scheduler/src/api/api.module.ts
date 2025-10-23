/**
 * API Module
 * Provides API client for communicating with the main API service
 */

import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';

import { ApiClientService } from './api-client.service';

@Module({
  imports: [ConfigModule],
  providers: [ApiClientService],
  exports: [ApiClientService],
})
export class ApiModule {}
