/**
 * WebSocket subscription types and utilities
 */

/**
 * Types of subscription rooms supported by the WebSocket gateway
 */
export enum RoomType {
  CAMPAIGN = 'campaign',
  SETTLEMENT = 'settlement',
  STRUCTURE = 'structure',
}

/**
 * Authenticated user data attached to WebSocket connection
 */
export interface AuthenticatedSocketData {
  userId: string;
  email: string;
}

/**
 * Subscription request payload
 */
export interface SubscriptionPayload {
  /** ID of the entity to subscribe to */
  entityId: string;
  /** Type of room (optional, can be inferred from event name) */
  roomType?: RoomType;
}

/**
 * Unsubscription request payload
 */
export interface UnsubscriptionPayload {
  /** ID of the entity to unsubscribe from */
  entityId: string;
  /** Type of room (optional, can be inferred from event name) */
  roomType?: RoomType;
}

/**
 * Generate a room name for a specific entity
 *
 * @param roomType - Type of room (campaign, settlement, structure)
 * @param entityId - ID of the entity
 * @returns Formatted room name (e.g., "campaign:123", "settlement:456")
 * @throws Error if entityId is empty or contains only whitespace
 */
export function getRoomName(roomType: RoomType, entityId: string): string {
  if (!entityId || entityId.trim().length === 0) {
    throw new Error(`Invalid entityId: must be a non-empty string`);
  }
  return `${roomType}:${entityId}`;
}

/**
 * Parse a room name into its components
 *
 * @param roomName - Room name to parse (e.g., "campaign:123")
 * @returns Object with roomType and entityId, or null if invalid
 */
export function parseRoomName(roomName: string): { roomType: RoomType; entityId: string } | null {
  const parts = roomName.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [type, id] = parts;
  if (!Object.values(RoomType).includes(type as RoomType)) {
    return null;
  }

  return {
    roomType: type as RoomType,
    entityId: id,
  };
}
