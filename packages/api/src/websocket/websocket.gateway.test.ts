/**
 * WebSocket Gateway Tests
 * Tests for the WebSocket gateway initialization, authentication, and subscription logic
 */

import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';

import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CampaignMembershipService } from '../auth/services/campaign-membership.service';

import type { AuthenticatedSocketData } from './types';
import { getRoomName, RoomType } from './types';
import { WebSocketPublisherService } from './websocket-publisher.service';
import { WebSocketGatewayClass } from './websocket.gateway';

describe('WebSocketGatewayClass', () => {
  let gateway: WebSocketGatewayClass;
  let jwtService: jest.Mocked<JwtService>;
  let campaignMembershipService: jest.Mocked<CampaignMembershipService>;

  beforeEach(async () => {
    // Create mocked services
    const mockJwtService = {
      verify: jest.fn(),
    };

    const mockCampaignMembershipService = {
      canView: jest.fn(),
    };

    const mockWebSocketPublisherService = {
      setServer: jest.fn(),
      publishEntityUpdated: jest.fn(),
      publishStateInvalidated: jest.fn(),
      publishWorldTimeChanged: jest.fn(),
      publishSettlementUpdated: jest.fn(),
      publishStructureUpdated: jest.fn(),
      publishEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGatewayClass,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: CampaignMembershipService,
          useValue: mockCampaignMembershipService,
        },
        {
          provide: WebSocketPublisherService,
          useValue: mockWebSocketPublisherService,
        },
      ],
    }).compile();

    gateway = module.get<WebSocketGatewayClass>(WebSocketGatewayClass);
    jwtService = module.get(JwtService);
    campaignMembershipService = module.get(CampaignMembershipService);
  });

  afterEach(async () => {
    // Close Redis connections if they were created
    if (gateway) {
      await gateway.closeRedisConnections();
    }

    // Clean up mocks
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(gateway).toBeDefined();
    });

    it('should have a server property', () => {
      expect(gateway.server).toBeUndefined(); // Not initialized until afterInit is called
    });

    it('should initialize with zero connected clients', () => {
      expect(gateway.getConnectedClientCount()).toBe(0);
    });
  });

  describe('afterInit', () => {
    it('should initialize the gateway', async () => {
      const mockServer = {
        adapter: jest.fn(),
      } as unknown as Server;

      // Note: In a real test environment, Redis connection would fail
      // since Redis is not available. The gateway is designed to handle this gracefully.
      await gateway.afterInit(mockServer);

      expect(gateway.server).toBe(mockServer);
    });
  });

  describe('handleConnection - Authentication', () => {
    it('should authenticate client with valid JWT token in handshake.auth', async () => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const mockClient = {
        id: 'test-client-1',
        handshake: {
          auth: { token: 'valid-jwt-token' },
          query: {},
        },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);

      // Verify JWT was validated
      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt-token');

      // Verify user data was stored in socket.data
      const userData = mockClient.data as AuthenticatedSocketData;
      expect(userData.userId).toBe('user-123');
      expect(userData.email).toBe('test@example.com');

      // Verify client was tracked
      expect(gateway.getConnectedClientCount()).toBe(1);

      // Verify client was NOT disconnected
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate client with valid JWT token in handshake.query', async () => {
      const mockPayload: JwtPayload = {
        sub: 'user-456',
        email: 'query@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const mockClient = {
        id: 'test-client-2',
        handshake: {
          auth: {},
          query: { token: 'valid-query-token' },
        },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);

      // Verify JWT was validated
      expect(jwtService.verify).toHaveBeenCalledWith('valid-query-token');

      // Verify user data was stored
      const userData = mockClient.data as AuthenticatedSocketData;
      expect(userData.userId).toBe('user-456');
      expect(userData.email).toBe('query@example.com');

      // Verify client was tracked
      expect(gateway.getConnectedClientCount()).toBe(1);
    });

    it('should reject client with invalid JWT token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const mockClient = {
        id: 'test-client-3',
        handshake: {
          auth: { token: 'invalid-jwt-token' },
          query: {},
        },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);

      // Verify JWT verification was attempted
      expect(jwtService.verify).toHaveBeenCalledWith('invalid-jwt-token');

      // Verify client was disconnected
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);

      // Verify client was NOT tracked
      expect(gateway.getConnectedClientCount()).toBe(0);
    });

    it('should reject client with missing JWT token', async () => {
      const mockClient = {
        id: 'test-client-4',
        handshake: {
          auth: {},
          query: {},
        },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);

      // Verify JWT verification was NOT attempted
      expect(jwtService.verify).not.toHaveBeenCalled();

      // Verify client was disconnected
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);

      // Verify client was NOT tracked
      expect(gateway.getConnectedClientCount()).toBe(0);
    });

    it('should reject client with non-string token', async () => {
      const mockClient = {
        id: 'test-client-5',
        handshake: {
          auth: { token: 12345 }, // Non-string token
          query: {},
        },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);

      // Verify JWT verification was NOT attempted
      expect(jwtService.verify).not.toHaveBeenCalled();

      // Verify client was disconnected
      expect(mockClient.disconnect).toHaveBeenCalledWith(true);

      // Verify client was NOT tracked
      expect(gateway.getConnectedClientCount()).toBe(0);
    });

    it('should track multiple authenticated clients', async () => {
      const mockPayload1: JwtPayload = {
        sub: 'user-1',
        email: 'user1@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      const mockPayload2: JwtPayload = {
        sub: 'user-2',
        email: 'user2@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };

      jwtService.verify.mockReturnValueOnce(mockPayload1).mockReturnValueOnce(mockPayload2);

      const mockClient1 = {
        id: 'client-1',
        handshake: { auth: { token: 'token1' }, query: {} },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      const mockClient2 = {
        id: 'client-2',
        handshake: { auth: { token: 'token2' }, query: {} },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient1);
      await gateway.handleConnection(mockClient2);

      expect(gateway.getConnectedClientCount()).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove disconnected clients', async () => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      const mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      await gateway.handleConnection(mockClient);
      expect(gateway.getConnectedClientCount()).toBe(1);

      gateway.handleDisconnect(mockClient);
      expect(gateway.getConnectedClientCount()).toBe(0);
    });

    it('should handle disconnect of non-existent client gracefully', () => {
      const mockClient = { id: 'non-existent-client' } as any;

      // Should not throw
      expect(() => gateway.handleDisconnect(mockClient)).not.toThrow();
      expect(gateway.getConnectedClientCount()).toBe(0);
    });
  });

  describe('subscription - campaign', () => {
    let mockClient: Socket;

    beforeEach(() => {
      // Create authenticated mock client
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;
    });

    it('should allow authorized user to subscribe to campaign', async () => {
      campaignMembershipService.canView.mockResolvedValue(true);

      const result = await gateway.handleSubscribeToCampaign(mockClient, {
        entityId: 'campaign-123',
      });

      // Verify authorization check was performed
      expect(campaignMembershipService.canView).toHaveBeenCalledWith('campaign-123', 'user-123');

      // Verify client joined the room
      const expectedRoomName = getRoomName(RoomType.CAMPAIGN, 'campaign-123');
      expect(mockClient.join).toHaveBeenCalledWith(expectedRoomName);

      // Verify success response
      expect(result).toEqual({ success: true });
    });

    it('should reject unauthorized user from subscribing to campaign', async () => {
      campaignMembershipService.canView.mockResolvedValue(false);

      const result = await gateway.handleSubscribeToCampaign(mockClient, {
        entityId: 'campaign-456',
      });

      // Verify authorization check was performed
      expect(campaignMembershipService.canView).toHaveBeenCalledWith('campaign-456', 'user-123');

      // Verify client did NOT join the room
      expect(mockClient.join).not.toHaveBeenCalled();

      // Verify error response
      expect(result).toEqual({ success: false, error: 'Unauthorized' });
    });

    it('should handle authorization errors gracefully', async () => {
      campaignMembershipService.canView.mockRejectedValue(new Error('Database error'));

      const result = await gateway.handleSubscribeToCampaign(mockClient, {
        entityId: 'campaign-789',
      });

      // Verify client did NOT join the room
      expect(mockClient.join).not.toHaveBeenCalled();

      // Verify error response
      expect(result).toEqual({ success: false, error: 'Subscription failed' });
    });
  });

  describe('subscription - settlement', () => {
    let mockClient: Socket;

    beforeEach(() => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;
    });

    it('should allow user to subscribe to settlement', async () => {
      const result = await gateway.handleSubscribeToSettlement(mockClient, {
        entityId: 'settlement-123',
      });

      // Verify client joined the room
      const expectedRoomName = getRoomName(RoomType.SETTLEMENT, 'settlement-123');
      expect(mockClient.join).toHaveBeenCalledWith(expectedRoomName);

      // Verify success response
      expect(result).toEqual({ success: true });
    });

    it('should handle settlement subscription errors gracefully', async () => {
      mockClient.join = jest.fn().mockRejectedValue(new Error('Join failed'));

      const result = await gateway.handleSubscribeToSettlement(mockClient, {
        entityId: 'settlement-456',
      });

      // Verify error response
      expect(result).toEqual({ success: false, error: 'Subscription failed' });
    });
  });

  describe('subscription - structure', () => {
    let mockClient: Socket;

    beforeEach(() => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;
    });

    it('should allow user to subscribe to structure', async () => {
      const result = await gateway.handleSubscribeToStructure(mockClient, {
        entityId: 'structure-123',
      });

      // Verify client joined the room
      const expectedRoomName = getRoomName(RoomType.STRUCTURE, 'structure-123');
      expect(mockClient.join).toHaveBeenCalledWith(expectedRoomName);

      // Verify success response
      expect(result).toEqual({ success: true });
    });

    it('should handle structure subscription errors gracefully', async () => {
      mockClient.join = jest.fn().mockRejectedValue(new Error('Join failed'));

      const result = await gateway.handleSubscribeToStructure(mockClient, {
        entityId: 'structure-456',
      });

      // Verify error response
      expect(result).toEqual({ success: false, error: 'Subscription failed' });
    });
  });

  describe('unsubscription - campaign', () => {
    let mockClient: Socket;

    beforeEach(() => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;
    });

    it('should allow user to unsubscribe from campaign', async () => {
      const result = await gateway.handleUnsubscribeFromCampaign(mockClient, {
        entityId: 'campaign-123',
      });

      // Verify client left the room
      const expectedRoomName = getRoomName(RoomType.CAMPAIGN, 'campaign-123');
      expect(mockClient.leave).toHaveBeenCalledWith(expectedRoomName);

      // Verify success response
      expect(result).toEqual({ success: true });
    });

    it('should handle campaign unsubscription errors gracefully', async () => {
      mockClient.leave = jest.fn().mockRejectedValue(new Error('Leave failed'));

      const result = await gateway.handleUnsubscribeFromCampaign(mockClient, {
        entityId: 'campaign-456',
      });

      // Verify error response
      expect(result).toEqual({ success: false });
    });
  });

  describe('unsubscription - settlement', () => {
    let mockClient: Socket;

    beforeEach(() => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;
    });

    it('should allow user to unsubscribe from settlement', async () => {
      const result = await gateway.handleUnsubscribeFromSettlement(mockClient, {
        entityId: 'settlement-123',
      });

      // Verify client left the room
      const expectedRoomName = getRoomName(RoomType.SETTLEMENT, 'settlement-123');
      expect(mockClient.leave).toHaveBeenCalledWith(expectedRoomName);

      // Verify success response
      expect(result).toEqual({ success: true });
    });

    it('should handle settlement unsubscription errors gracefully', async () => {
      mockClient.leave = jest.fn().mockRejectedValue(new Error('Leave failed'));

      const result = await gateway.handleUnsubscribeFromSettlement(mockClient, {
        entityId: 'settlement-456',
      });

      // Verify error response
      expect(result).toEqual({ success: false });
    });
  });

  describe('unsubscription - structure', () => {
    let mockClient: Socket;

    beforeEach(() => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;
    });

    it('should allow user to unsubscribe from structure', async () => {
      const result = await gateway.handleUnsubscribeFromStructure(mockClient, {
        entityId: 'structure-123',
      });

      // Verify client left the room
      const expectedRoomName = getRoomName(RoomType.STRUCTURE, 'structure-123');
      expect(mockClient.leave).toHaveBeenCalledWith(expectedRoomName);

      // Verify success response
      expect(result).toEqual({ success: true });
    });

    it('should handle structure unsubscription errors gracefully', async () => {
      mockClient.leave = jest.fn().mockRejectedValue(new Error('Leave failed'));

      const result = await gateway.handleUnsubscribeFromStructure(mockClient, {
        entityId: 'structure-456',
      });

      // Verify error response
      expect(result).toEqual({ success: false });
    });
  });

  describe('multiple simultaneous subscriptions', () => {
    let mockClient: Socket;

    beforeEach(() => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: { userId: 'user-123', email: 'test@example.com' },
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;

      campaignMembershipService.canView.mockResolvedValue(true);
    });

    it('should allow subscribing to multiple campaigns', async () => {
      const result1 = await gateway.handleSubscribeToCampaign(mockClient, {
        entityId: 'campaign-1',
      });
      const result2 = await gateway.handleSubscribeToCampaign(mockClient, {
        entityId: 'campaign-2',
      });

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });

      expect(mockClient.join).toHaveBeenCalledTimes(2);
      expect(mockClient.join).toHaveBeenCalledWith(getRoomName(RoomType.CAMPAIGN, 'campaign-1'));
      expect(mockClient.join).toHaveBeenCalledWith(getRoomName(RoomType.CAMPAIGN, 'campaign-2'));
    });

    it('should allow subscribing to different entity types', async () => {
      const result1 = await gateway.handleSubscribeToCampaign(mockClient, {
        entityId: 'campaign-1',
      });
      const result2 = await gateway.handleSubscribeToSettlement(mockClient, {
        entityId: 'settlement-1',
      });
      const result3 = await gateway.handleSubscribeToStructure(mockClient, {
        entityId: 'structure-1',
      });

      expect(result1).toEqual({ success: true });
      expect(result2).toEqual({ success: true });
      expect(result3).toEqual({ success: true });

      expect(mockClient.join).toHaveBeenCalledTimes(3);
      expect(mockClient.join).toHaveBeenCalledWith(getRoomName(RoomType.CAMPAIGN, 'campaign-1'));
      expect(mockClient.join).toHaveBeenCalledWith(
        getRoomName(RoomType.SETTLEMENT, 'settlement-1')
      );
      expect(mockClient.join).toHaveBeenCalledWith(getRoomName(RoomType.STRUCTURE, 'structure-1'));
    });
  });

  describe('automatic room cleanup on disconnect', () => {
    it('should remove client from tracking on disconnect', async () => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      const mockClient = {
        id: 'test-client-1',
        handshake: { auth: { token: 'valid-token' }, query: {} },
        data: {},
        disconnect: jest.fn(),
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
      } as unknown as Socket;

      // Connect client
      await gateway.handleConnection(mockClient);
      expect(gateway.getConnectedClientCount()).toBe(1);

      // Subscribe to rooms
      campaignMembershipService.canView.mockResolvedValue(true);
      await gateway.handleSubscribeToCampaign(mockClient, { entityId: 'campaign-1' });
      await gateway.handleSubscribeToSettlement(mockClient, { entityId: 'settlement-1' });

      // Disconnect client
      gateway.handleDisconnect(mockClient);

      // Verify client was removed from tracking
      expect(gateway.getConnectedClientCount()).toBe(0);

      // Note: Socket.IO automatically handles room cleanup on disconnect
      // We don't need to manually call leave() for each room
      // This test verifies our tracking is cleaned up correctly
    });

    it('should handle multiple disconnects correctly', async () => {
      const mockPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: 1234567890,
        exp: 9999999999,
      };
      jwtService.verify.mockReturnValue(mockPayload);

      const mockClient1 = {
        id: 'client-1',
        handshake: { auth: { token: 'token1' }, query: {} },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      const mockClient2 = {
        id: 'client-2',
        handshake: { auth: { token: 'token2' }, query: {} },
        data: {},
        disconnect: jest.fn(),
      } as unknown as Socket;

      // Connect both clients
      await gateway.handleConnection(mockClient1);
      await gateway.handleConnection(mockClient2);
      expect(gateway.getConnectedClientCount()).toBe(2);

      // Disconnect first client
      gateway.handleDisconnect(mockClient1);
      expect(gateway.getConnectedClientCount()).toBe(1);

      // Disconnect second client
      gateway.handleDisconnect(mockClient2);
      expect(gateway.getConnectedClientCount()).toBe(0);
    });
  });

  describe('emitToRoom', () => {
    it('should have emitToRoom method', () => {
      expect(gateway.emitToRoom).toBeDefined();
      expect(typeof gateway.emitToRoom).toBe('function');
    });
  });

  describe('emitToAll', () => {
    it('should have emitToAll method', () => {
      expect(gateway.emitToAll).toBeDefined();
      expect(typeof gateway.emitToAll).toBe('function');
    });
  });
});
