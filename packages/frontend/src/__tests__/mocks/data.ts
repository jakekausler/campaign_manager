/**
 * Mock data for tests
 *
 * Provides realistic test data for Settlement and Structure entities.
 */

export const mockSettlements = [
  {
    id: 'settlement-1',
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    name: 'Ironhold',
    level: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      population: 1500,
      defense: 25,
    },
  },
  {
    id: 'settlement-2',
    kingdomId: 'kingdom-1',
    locationId: 'location-2',
    name: 'Silverkeep',
    level: 2,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      population: 800,
      defense: 15,
    },
  },
  {
    id: 'settlement-3',
    kingdomId: 'kingdom-2',
    locationId: 'location-3',
    name: 'Stormwatch',
    level: 4,
    createdAt: '2024-01-03T00:00:00.000Z',
    updatedAt: '2024-01-03T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      population: 2500,
      defense: 40,
    },
  },
];

export const mockStructures = [
  {
    id: 'structure-1',
    settlementId: 'settlement-1',
    typeId: 'barracks',
    name: 'Main Barracks',
    x: 10,
    y: 20,
    orientation: 0,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      capacity: 100,
      training_speed: 1.2,
    },
  },
  {
    id: 'structure-2',
    settlementId: 'settlement-1',
    typeId: 'marketplace',
    name: 'Central Market',
    x: 30,
    y: 40,
    orientation: 90,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      trade_bonus: 0.15,
      capacity: 50,
    },
  },
  {
    id: 'structure-3',
    settlementId: 'settlement-2',
    typeId: 'temple',
    name: 'Temple of Light',
    x: 15,
    y: 25,
    orientation: 180,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      faith: 50,
      healing_rate: 0.1,
    },
  },
];
