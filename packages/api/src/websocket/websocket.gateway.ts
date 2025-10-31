/**
 * WebSocket Gateway
 * Handles WebSocket connections using Socket.IO with Redis adapter for horizontal scaling
 */

import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';

/**
 * WebSocket Gateway for real-time updates
 *
 * Uses Socket.IO with Redis pub/sub adapter to enable:
 * - Horizontal scaling across multiple API instances
 * - Room-based subscriptions for campaign/settlement/structure scoping
 * - Bi-directional real-time communication
 *
 * Connection URL: ws://localhost:3000/socket.io (Socket.IO client handles path)
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:9263',
    credentials: true,
  },
  // Socket.IO will use its default path (/socket.io)
  // and automatically handle WebSocket vs. long-polling fallback
})
export class WebSocketGatewayClass
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebSocketGatewayClass.name);
  private readonly connectedClients = new Map<string, Socket>();

  /**
   * Initialize the WebSocket gateway with Redis adapter
   * Called once when the gateway is initialized
   */
  async afterInit(server: Server): Promise<void> {
    // Store server reference (important for test environment where @WebSocketServer decorator may not work)
    this.server = server;

    this.logger.log('WebSocket Gateway initialized');

    try {
      // Create Redis clients for pub/sub
      const pubClient = createClient({
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        password: process.env.REDIS_PASSWORD || undefined,
      });

      const subClient = pubClient.duplicate();

      // Add error handlers
      pubClient.on('error', (err) => {
        this.logger.error('Redis Pub Client Error:', err);
      });

      subClient.on('error', (err) => {
        this.logger.error('Redis Sub Client Error:', err);
      });

      // Connect clients
      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.logger.log('Redis clients connected for Socket.IO adapter');

      // Attach Redis adapter to Socket.IO server
      server.adapter(createAdapter(pubClient, subClient));

      this.logger.log('Redis adapter attached to Socket.IO server');
    } catch (error) {
      this.logger.error('Failed to initialize Redis adapter:', error);
      // Don't throw - allow server to start even if Redis is unavailable
      // Clients will still be able to connect to this instance
      // but events won't propagate across multiple instances
    }
  }

  /**
   * Handle new client connections
   * @param client - The connected Socket.IO client
   */
  async handleConnection(client: Socket): Promise<void> {
    const clientId = client.id;
    this.connectedClients.set(clientId, client);

    this.logger.log(`Client connected: ${clientId}`);
    this.logger.debug(`Total connected clients: ${this.connectedClients.size}`);

    // TODO: Extract and validate authentication token from handshake
    // TODO: Store user/session info associated with this client
  }

  /**
   * Handle client disconnections
   * @param client - The disconnected Socket.IO client
   */
  handleDisconnect(client: Socket): void {
    const clientId = client.id;
    this.connectedClients.delete(clientId);

    this.logger.log(`Client disconnected: ${clientId}`);
    this.logger.debug(`Total connected clients: ${this.connectedClients.size}`);

    // Socket.IO automatically handles room cleanup on disconnect
    // No manual cleanup needed
  }

  /**
   * Get the number of currently connected clients
   * Useful for monitoring and health checks
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Emit an event to a specific room
   * @param room - Room name (e.g., "campaign:123")
   * @param event - Event name
   * @param data - Event payload
   */
  emitToRoom(room: string, event: string, data: unknown): void {
    this.server.to(room).emit(event, data);
    this.logger.debug(`Emitted "${event}" to room "${room}"`);
  }

  /**
   * Emit an event to all connected clients
   * @param event - Event name
   * @param data - Event payload
   */
  emitToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
    this.logger.debug(`Emitted "${event}" to all clients`);
  }
}
