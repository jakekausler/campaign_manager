/**
 * WebSocket Module
 * Configures the WebSocket gateway for real-time updates
 */

import { Module } from '@nestjs/common';

import { WebSocketGatewayClass } from './websocket.gateway';

@Module({
  providers: [WebSocketGatewayClass],
  exports: [WebSocketGatewayClass],
})
export class WebSocketModule {}
