/**
 * WebSocket Gateway
 * Handles WebSocket connections using Socket.IO with Redis adapter for horizontal scaling
 */

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server, Socket } from 'socket.io';

import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CampaignMembershipService } from '../auth/services/campaign-membership.service';

import type { AuthenticatedSocketData, SubscriptionPayload, UnsubscriptionPayload } from './types';
import { getRoomName, RoomType } from './types';

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

  constructor(
    private readonly jwtService: JwtService,
    private readonly campaignMembershipService: CampaignMembershipService
  ) {}

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
   * Validates JWT token and stores user info in socket.data
   * @param client - The connected Socket.IO client
   */
  async handleConnection(client: Socket): Promise<void> {
    const clientId = client.id;

    try {
      // Extract JWT token from handshake (auth.token or query.token)
      const token = client.handshake.auth?.token || client.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Client ${clientId} rejected: No authentication token`);
        client.disconnect(true);
        return;
      }

      // Verify and decode JWT token
      const payload = this.jwtService.verify<JwtPayload>(token);

      // Store authenticated user data in socket.data
      const userData: AuthenticatedSocketData = {
        userId: payload.sub,
        email: payload.email,
      };
      client.data = userData;

      // Add to connected clients map
      this.connectedClients.set(clientId, client);

      this.logger.log(`Client connected: ${clientId} (user: ${userData.userId})`);
      this.logger.debug(`Total connected clients: ${this.connectedClients.size}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Client ${clientId} rejected: Invalid authentication token - ${errorMessage}`
      );
      client.disconnect(true);
    }
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
   * Handle campaign subscription requests
   * Validates user access before allowing room subscription
   */
  @SubscribeMessage('subscribe_campaign')
  async handleSubscribeToCampaign(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscriptionPayload
  ): Promise<{ success: boolean; error?: string }> {
    const userData = client.data as AuthenticatedSocketData;
    const { entityId: campaignId } = payload;

    this.logger.debug(`User ${userData.userId} requesting campaign subscription: ${campaignId}`);

    try {
      // Check if user has view access to this campaign
      const hasAccess = await this.campaignMembershipService.canView(campaignId, userData.userId);

      if (!hasAccess) {
        this.logger.warn(`User ${userData.userId} denied access to campaign ${campaignId}`);
        return { success: false, error: 'Unauthorized' };
      }

      // Subscribe to campaign room
      const roomName = getRoomName(RoomType.CAMPAIGN, campaignId);
      await client.join(roomName);

      this.logger.log(`User ${userData.userId} subscribed to campaign room: ${roomName}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error subscribing to campaign ${campaignId}:`, error);
      return { success: false, error: 'Subscription failed' };
    }
  }

  /**
   * Handle settlement subscription requests
   * Validates user access to parent campaign before allowing room subscription
   */
  @SubscribeMessage('subscribe_settlement')
  async handleSubscribeToSettlement(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscriptionPayload
  ): Promise<{ success: boolean; error?: string }> {
    const userData = client.data as AuthenticatedSocketData;
    const { entityId: settlementId } = payload;

    this.logger.debug(
      `User ${userData.userId} requesting settlement subscription: ${settlementId}`
    );

    // TODO: Need to look up parent campaign ID from settlement
    // For now, we'll implement a basic subscription without campaign check
    // This will be enhanced in Stage 3 when we add settlement/structure relationships
    this.logger.warn(
      `Settlement subscription without campaign authorization check - Stage 3 feature pending`
    );

    try {
      // Subscribe to settlement room
      const roomName = getRoomName(RoomType.SETTLEMENT, settlementId);
      await client.join(roomName);

      this.logger.log(`User ${userData.userId} subscribed to settlement room: ${roomName}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error subscribing to settlement ${settlementId}:`, error);
      return { success: false, error: 'Subscription failed' };
    }
  }

  /**
   * Handle structure subscription requests
   * Validates user access to parent campaign before allowing room subscription
   */
  @SubscribeMessage('subscribe_structure')
  async handleSubscribeToStructure(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscriptionPayload
  ): Promise<{ success: boolean; error?: string }> {
    const userData = client.data as AuthenticatedSocketData;
    const { entityId: structureId } = payload;

    this.logger.debug(`User ${userData.userId} requesting structure subscription: ${structureId}`);

    // TODO: Need to look up parent campaign ID from structure
    // For now, we'll implement a basic subscription without campaign check
    // This will be enhanced in Stage 3 when we add settlement/structure relationships
    this.logger.warn(
      `Structure subscription without campaign authorization check - Stage 3 feature pending`
    );

    try {
      // Subscribe to structure room
      const roomName = getRoomName(RoomType.STRUCTURE, structureId);
      await client.join(roomName);

      this.logger.log(`User ${userData.userId} subscribed to structure room: ${roomName}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error subscribing to structure ${structureId}:`, error);
      return { success: false, error: 'Subscription failed' };
    }
  }

  /**
   * Handle campaign unsubscription requests
   */
  @SubscribeMessage('unsubscribe_campaign')
  async handleUnsubscribeFromCampaign(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UnsubscriptionPayload
  ): Promise<{ success: boolean }> {
    const userData = client.data as AuthenticatedSocketData;
    const { entityId: campaignId } = payload;

    try {
      const roomName = getRoomName(RoomType.CAMPAIGN, campaignId);
      await client.leave(roomName);

      this.logger.log(`User ${userData.userId} unsubscribed from campaign room: ${roomName}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error unsubscribing from campaign ${campaignId}:`, error);
      return { success: false };
    }
  }

  /**
   * Handle settlement unsubscription requests
   */
  @SubscribeMessage('unsubscribe_settlement')
  async handleUnsubscribeFromSettlement(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UnsubscriptionPayload
  ): Promise<{ success: boolean }> {
    const userData = client.data as AuthenticatedSocketData;
    const { entityId: settlementId } = payload;

    try {
      const roomName = getRoomName(RoomType.SETTLEMENT, settlementId);
      await client.leave(roomName);

      this.logger.log(`User ${userData.userId} unsubscribed from settlement room: ${roomName}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error unsubscribing from settlement ${settlementId}:`, error);
      return { success: false };
    }
  }

  /**
   * Handle structure unsubscription requests
   */
  @SubscribeMessage('unsubscribe_structure')
  async handleUnsubscribeFromStructure(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: UnsubscriptionPayload
  ): Promise<{ success: boolean }> {
    const userData = client.data as AuthenticatedSocketData;
    const { entityId: structureId } = payload;

    try {
      const roomName = getRoomName(RoomType.STRUCTURE, structureId);
      await client.leave(roomName);

      this.logger.log(`User ${userData.userId} unsubscribed from structure room: ${roomName}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Error unsubscribing from structure ${structureId}:`, error);
      return { success: false };
    }
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
