/**
 * WebSocket Gateway Tests
 * Tests for the WebSocket gateway initialization and lifecycle
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';

import { WebSocketGatewayClass } from './websocket.gateway';

describe('WebSocketGatewayClass', () => {
  let gateway: WebSocketGatewayClass;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketGatewayClass],
    }).compile();

    gateway = module.get<WebSocketGatewayClass>(WebSocketGatewayClass);
  });

  afterEach(() => {
    // Clean up any connections
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

  describe('handleConnection', () => {
    it('should track connected clients', async () => {
      const mockClient = {
        id: 'test-client-1',
      } as any;

      await gateway.handleConnection(mockClient);

      expect(gateway.getConnectedClientCount()).toBe(1);
    });

    it('should track multiple connected clients', async () => {
      const mockClient1 = { id: 'test-client-1' } as any;
      const mockClient2 = { id: 'test-client-2' } as any;

      await gateway.handleConnection(mockClient1);
      await gateway.handleConnection(mockClient2);

      expect(gateway.getConnectedClientCount()).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove disconnected clients', async () => {
      const mockClient = {
        id: 'test-client-1',
      } as any;

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
