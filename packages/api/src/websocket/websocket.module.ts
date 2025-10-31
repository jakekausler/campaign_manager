/**
 * WebSocket Module
 * Configures the WebSocket gateway for real-time updates
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { WebSocketGatewayClass } from './websocket.gateway';

@Module({
  imports: [AuthModule],
  providers: [WebSocketGatewayClass],
  exports: [WebSocketGatewayClass],
})
export class WebSocketModule {}
