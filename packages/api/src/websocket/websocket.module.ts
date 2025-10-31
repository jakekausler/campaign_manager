/**
 * WebSocket Module
 * Configures the WebSocket gateway for real-time updates
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { WebSocketPublisherService } from './websocket-publisher.service';
import { WebSocketGatewayClass } from './websocket.gateway';

@Module({
  imports: [AuthModule],
  providers: [WebSocketGatewayClass, WebSocketPublisherService],
  exports: [WebSocketGatewayClass, WebSocketPublisherService],
})
export class WebSocketModule {}
