/**
 * WebSocket Publisher Service Tests
 * Tests for the WebSocket event publisher service that broadcasts events to connected clients
 */

import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'socket.io';

import {
  createEntityUpdatedEvent,
  createStateInvalidatedEvent,
  createWorldTimeChangedEvent,
  createSettlementUpdatedEvent,
  createStructureUpdatedEvent,
} from '@campaign/shared';

import { getRoomName, RoomType } from './types';
import { WebSocketPublisherService } from './websocket-publisher.service';

describe('WebSocketPublisherService', () => {
  let service: WebSocketPublisherService;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    // Create a mock Socket.IO server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<Server>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [WebSocketPublisherService],
    }).compile();

    service = module.get<WebSocketPublisherService>(WebSocketPublisherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should not have a server before setServer is called', () => {
      expect(service['server']).toBeNull();
    });

    it('should set the server instance when setServer is called', () => {
      service.setServer(mockServer);
      expect(service['server']).toBe(mockServer);
    });
  });

  describe('publishEntityUpdated', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should publish entity_updated event to campaign room for generic entities', () => {
      const event = createEntityUpdatedEvent('campaign', 'entity-123', 'campaign-456');

      service.publishEntityUpdated(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      expect(mockServer.to).toHaveBeenCalledWith(campaignRoom);
      expect(mockServer.emit).toHaveBeenCalledWith('entity_updated', event);
      expect(mockServer.to).toHaveBeenCalledTimes(1);
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

    it('should publish entity_updated event to campaign and settlement rooms for settlement entities', () => {
      const event = createEntityUpdatedEvent('settlement', 'settlement-123', 'campaign-456');

      service.publishEntityUpdated(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      const settlementRoom = getRoomName(RoomType.SETTLEMENT, 'settlement-123');

      expect(mockServer.to).toHaveBeenNthCalledWith(1, campaignRoom);
      expect(mockServer.to).toHaveBeenNthCalledWith(2, settlementRoom);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenNthCalledWith(1, 'entity_updated', event);
      expect(mockServer.emit).toHaveBeenNthCalledWith(2, 'entity_updated', event);
    });

    it('should publish entity_updated event to campaign and structure rooms for structure entities', () => {
      const event = createEntityUpdatedEvent('structure', 'structure-123', 'campaign-456');

      service.publishEntityUpdated(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      const structureRoom = getRoomName(RoomType.STRUCTURE, 'structure-123');

      expect(mockServer.to).toHaveBeenNthCalledWith(1, campaignRoom);
      expect(mockServer.to).toHaveBeenNthCalledWith(2, structureRoom);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenNthCalledWith(1, 'entity_updated', event);
      expect(mockServer.emit).toHaveBeenNthCalledWith(2, 'entity_updated', event);
    });

    it('should include metadata and changed fields in the event', () => {
      const event = createEntityUpdatedEvent('campaign', 'entity-123', 'campaign-456', {
        changedFields: ['name', 'description'],
        userId: 'user-789',
        source: 'api',
        correlationId: 'corr-abc',
      });

      service.publishEntityUpdated(event);

      expect(mockServer.emit).toHaveBeenCalledWith('entity_updated', event);
      expect(event.payload.changedFields).toEqual(['name', 'description']);
      expect(event.metadata?.userId).toBe('user-789');
      expect(event.metadata?.source).toBe('api');
      expect(event.metadata?.correlationId).toBe('corr-abc');
    });

    it('should warn and skip publishing when server is not initialized', () => {
      const uninitializedService = new WebSocketPublisherService();
      const loggerWarnSpy = jest.spyOn(uninitializedService['logger'], 'warn');

      const event = createEntityUpdatedEvent('campaign', 'entity-123', 'campaign-456');
      uninitializedService.publishEntityUpdated(event);

      expect(loggerWarnSpy).toHaveBeenCalledWith('Cannot publish event - server not initialized');
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('publishStateInvalidated', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should publish state_invalidated event to campaign room', () => {
      const event = createStateInvalidatedEvent('campaign-456', 'campaign');

      service.publishStateInvalidated(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      expect(mockServer.to).toHaveBeenCalledWith(campaignRoom);
      expect(mockServer.emit).toHaveBeenCalledWith('state_invalidated', event);
      expect(mockServer.to).toHaveBeenCalledTimes(1);
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

    it('should include entity-scoped invalidation data', () => {
      const event = createStateInvalidatedEvent('campaign-456', 'entity', {
        entityIds: ['entity-1', 'entity-2', 'entity-3'],
        reason: 'Computed field updated',
        userId: 'user-789',
      });

      service.publishStateInvalidated(event);

      expect(mockServer.emit).toHaveBeenCalledWith('state_invalidated', event);
      expect(event.payload.scope).toBe('entity');
      expect(event.payload.entityIds).toEqual(['entity-1', 'entity-2', 'entity-3']);
      expect(event.payload.reason).toBe('Computed field updated');
    });

    it('should warn and skip publishing when server is not initialized', () => {
      const uninitializedService = new WebSocketPublisherService();
      const loggerWarnSpy = jest.spyOn(uninitializedService['logger'], 'warn');

      const event = createStateInvalidatedEvent('campaign-456', 'campaign');
      uninitializedService.publishStateInvalidated(event);

      expect(loggerWarnSpy).toHaveBeenCalledWith('Cannot publish event - server not initialized');
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('publishWorldTimeChanged', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should publish world_time_changed event to campaign room', () => {
      const event = createWorldTimeChangedEvent(
        'campaign-456',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z'
      );

      service.publishWorldTimeChanged(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      expect(mockServer.to).toHaveBeenCalledWith(campaignRoom);
      expect(mockServer.emit).toHaveBeenCalledWith('world_time_changed', event);
      expect(mockServer.to).toHaveBeenCalledTimes(1);
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
    });

    it('should include elapsed time data in the event', () => {
      const event = createWorldTimeChangedEvent(
        'campaign-456',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z',
        {
          elapsed: { value: 1, unit: 'days' },
          userId: 'user-789',
          source: 'scheduler',
        }
      );

      service.publishWorldTimeChanged(event);

      expect(mockServer.emit).toHaveBeenCalledWith('world_time_changed', event);
      expect(event.payload.previousTime).toBe('2024-01-01T00:00:00Z');
      expect(event.payload.newTime).toBe('2024-01-02T00:00:00Z');
      expect(event.payload.elapsed).toEqual({ value: 1, unit: 'days' });
    });

    it('should warn and skip publishing when server is not initialized', () => {
      const uninitializedService = new WebSocketPublisherService();
      const loggerWarnSpy = jest.spyOn(uninitializedService['logger'], 'warn');

      const event = createWorldTimeChangedEvent(
        'campaign-456',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z'
      );
      uninitializedService.publishWorldTimeChanged(event);

      expect(loggerWarnSpy).toHaveBeenCalledWith('Cannot publish event - server not initialized');
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('publishSettlementUpdated', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should publish settlement_updated event to campaign and settlement rooms', () => {
      const event = createSettlementUpdatedEvent('settlement-123', 'campaign-456', 'create');

      service.publishSettlementUpdated(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      const settlementRoom = getRoomName(RoomType.SETTLEMENT, 'settlement-123');

      expect(mockServer.to).toHaveBeenNthCalledWith(1, campaignRoom);
      expect(mockServer.to).toHaveBeenNthCalledWith(2, settlementRoom);
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
      expect(mockServer.emit).toHaveBeenNthCalledWith(1, 'settlement_updated', event);
      expect(mockServer.emit).toHaveBeenNthCalledWith(2, 'settlement_updated', event);
    });

    it('should include operation type and changed fields for update operations', () => {
      const event = createSettlementUpdatedEvent('settlement-123', 'campaign-456', 'update', {
        changedFields: ['population', 'resources'],
        settlementData: { population: 5000, resources: 1000 },
        userId: 'user-789',
      });

      service.publishSettlementUpdated(event);

      expect(mockServer.emit).toHaveBeenCalledWith('settlement_updated', event);
      expect(event.payload.operation).toBe('update');
      expect(event.payload.changedFields).toEqual(['population', 'resources']);
      expect(event.payload.settlementData).toEqual({ population: 5000, resources: 1000 });
    });

    it('should publish delete operations', () => {
      const event = createSettlementUpdatedEvent('settlement-123', 'campaign-456', 'delete');

      service.publishSettlementUpdated(event);

      expect(mockServer.emit).toHaveBeenCalledWith('settlement_updated', event);
      expect(event.payload.operation).toBe('delete');
    });

    it('should warn and skip publishing when server is not initialized', () => {
      const uninitializedService = new WebSocketPublisherService();
      const loggerWarnSpy = jest.spyOn(uninitializedService['logger'], 'warn');

      const event = createSettlementUpdatedEvent('settlement-123', 'campaign-456', 'create');
      uninitializedService.publishSettlementUpdated(event);

      expect(loggerWarnSpy).toHaveBeenCalledWith('Cannot publish event - server not initialized');
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('publishStructureUpdated', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should publish structure_updated event to campaign, settlement, and structure rooms', () => {
      const event = createStructureUpdatedEvent(
        'structure-789',
        'settlement-123',
        'campaign-456',
        'create'
      );

      service.publishStructureUpdated(event);

      const campaignRoom = getRoomName(RoomType.CAMPAIGN, 'campaign-456');
      const settlementRoom = getRoomName(RoomType.SETTLEMENT, 'settlement-123');
      const structureRoom = getRoomName(RoomType.STRUCTURE, 'structure-789');

      expect(mockServer.to).toHaveBeenNthCalledWith(1, campaignRoom);
      expect(mockServer.to).toHaveBeenNthCalledWith(2, settlementRoom);
      expect(mockServer.to).toHaveBeenNthCalledWith(3, structureRoom);
      expect(mockServer.emit).toHaveBeenCalledTimes(3);
      expect(mockServer.emit).toHaveBeenNthCalledWith(1, 'structure_updated', event);
      expect(mockServer.emit).toHaveBeenNthCalledWith(2, 'structure_updated', event);
      expect(mockServer.emit).toHaveBeenNthCalledWith(3, 'structure_updated', event);
    });

    it('should include operation type and changed fields for update operations', () => {
      const event = createStructureUpdatedEvent(
        'structure-789',
        'settlement-123',
        'campaign-456',
        'update',
        {
          changedFields: ['health', 'capacity'],
          structureData: { health: 0.8, capacity: 50 },
          userId: 'user-789',
        }
      );

      service.publishStructureUpdated(event);

      expect(mockServer.emit).toHaveBeenCalledWith('structure_updated', event);
      expect(event.payload.operation).toBe('update');
      expect(event.payload.changedFields).toEqual(['health', 'capacity']);
      expect(event.payload.structureData).toEqual({ health: 0.8, capacity: 50 });
    });

    it('should publish delete operations', () => {
      const event = createStructureUpdatedEvent(
        'structure-789',
        'settlement-123',
        'campaign-456',
        'delete'
      );

      service.publishStructureUpdated(event);

      expect(mockServer.emit).toHaveBeenCalledWith('structure_updated', event);
      expect(event.payload.operation).toBe('delete');
    });

    it('should warn and skip publishing when server is not initialized', () => {
      const uninitializedService = new WebSocketPublisherService();
      const loggerWarnSpy = jest.spyOn(uninitializedService['logger'], 'warn');

      const event = createStructureUpdatedEvent(
        'structure-789',
        'settlement-123',
        'campaign-456',
        'create'
      );
      uninitializedService.publishStructureUpdated(event);

      expect(loggerWarnSpy).toHaveBeenCalledWith('Cannot publish event - server not initialized');
      expect(mockServer.to).not.toHaveBeenCalled();
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('publishEvent - generic dispatcher', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should dispatch entity_updated events to publishEntityUpdated', () => {
      const event = createEntityUpdatedEvent('campaign', 'entity-123', 'campaign-456');
      const spy = jest.spyOn(service, 'publishEntityUpdated');

      service.publishEvent(event);

      expect(spy).toHaveBeenCalledWith(event);
    });

    it('should dispatch state_invalidated events to publishStateInvalidated', () => {
      const event = createStateInvalidatedEvent('campaign-456', 'campaign');
      const spy = jest.spyOn(service, 'publishStateInvalidated');

      service.publishEvent(event);

      expect(spy).toHaveBeenCalledWith(event);
    });

    it('should dispatch world_time_changed events to publishWorldTimeChanged', () => {
      const event = createWorldTimeChangedEvent(
        'campaign-456',
        '2024-01-01T00:00:00Z',
        '2024-01-02T00:00:00Z'
      );
      const spy = jest.spyOn(service, 'publishWorldTimeChanged');

      service.publishEvent(event);

      expect(spy).toHaveBeenCalledWith(event);
    });

    it('should dispatch settlement_updated events to publishSettlementUpdated', () => {
      const event = createSettlementUpdatedEvent('settlement-123', 'campaign-456', 'create');
      const spy = jest.spyOn(service, 'publishSettlementUpdated');

      service.publishEvent(event);

      expect(spy).toHaveBeenCalledWith(event);
    });

    it('should dispatch structure_updated events to publishStructureUpdated', () => {
      const event = createStructureUpdatedEvent(
        'structure-789',
        'settlement-123',
        'campaign-456',
        'create'
      );
      const spy = jest.spyOn(service, 'publishStructureUpdated');

      service.publishEvent(event);

      expect(spy).toHaveBeenCalledWith(event);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should handle errors when emitting to rooms and log them', () => {
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      mockServer.emit.mockImplementation(() => {
        throw new Error('Socket.IO emission failed');
      });

      const event = createEntityUpdatedEvent('campaign', 'entity-123', 'campaign-456');
      service.publishEntityUpdated(event);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to publish entity_updated event to room campaign:campaign-456:',
        'Socket.IO emission failed'
      );
    });

    it('should handle non-Error exceptions gracefully', () => {
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      mockServer.emit.mockImplementation(() => {
        throw 'String error'; // eslint-disable-line no-throw-literal
      });

      const event = createEntityUpdatedEvent('campaign', 'entity-123', 'campaign-456');
      service.publishEntityUpdated(event);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to publish entity_updated event to room campaign:campaign-456:',
        'String error'
      );
    });
  });

  describe('room targeting logic', () => {
    beforeEach(() => {
      service.setServer(mockServer);
    });

    it('should target correct rooms for different entity types', () => {
      // Test campaign entity
      const campaignEvent = createEntityUpdatedEvent('campaign', 'campaign-456', 'campaign-456');
      service.publishEntityUpdated(campaignEvent);
      expect(mockServer.to).toHaveBeenCalledWith('campaign:campaign-456');
      expect(mockServer.to).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Test settlement entity
      const settlementEvent = createEntityUpdatedEvent(
        'settlement',
        'settlement-123',
        'campaign-456'
      );
      service.publishEntityUpdated(settlementEvent);
      expect(mockServer.to).toHaveBeenCalledWith('campaign:campaign-456');
      expect(mockServer.to).toHaveBeenCalledWith('settlement:settlement-123');
      expect(mockServer.to).toHaveBeenCalledTimes(2);

      jest.clearAllMocks();

      // Test structure entity
      const structureEvent = createEntityUpdatedEvent('structure', 'structure-789', 'campaign-456');
      service.publishEntityUpdated(structureEvent);
      expect(mockServer.to).toHaveBeenCalledWith('campaign:campaign-456');
      expect(mockServer.to).toHaveBeenCalledWith('structure:structure-789');
      expect(mockServer.to).toHaveBeenCalledTimes(2);
    });

    it('should use correct room names for settlement updates', () => {
      const event = createSettlementUpdatedEvent('settlement-abc', 'campaign-xyz', 'create');
      service.publishSettlementUpdated(event);

      expect(mockServer.to).toHaveBeenCalledWith('campaign:campaign-xyz');
      expect(mockServer.to).toHaveBeenCalledWith('settlement:settlement-abc');
    });

    it('should use correct room names for structure updates', () => {
      const event = createStructureUpdatedEvent(
        'structure-def',
        'settlement-abc',
        'campaign-xyz',
        'create'
      );
      service.publishStructureUpdated(event);

      expect(mockServer.to).toHaveBeenCalledWith('campaign:campaign-xyz');
      expect(mockServer.to).toHaveBeenCalledWith('settlement:settlement-abc');
      expect(mockServer.to).toHaveBeenCalledWith('structure:structure-def');
    });
  });
});
