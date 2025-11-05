/**
 * Mock data for tests
 *
 * Provides realistic test data for Settlement, Structure, Event, and Encounter entities.
 */

// Reduced to 2 essential events for memory efficiency
export const mockEvents = [
  {
    id: 'event-1',
    campaignId: 'campaign-1',
    locationId: 'location-1',
    name: 'Royal Festival',
    description: null,
    eventType: 'kingdom',
    scheduledAt: '2024-06-15T12:00:00.000Z',
    occurredAt: '2024-06-15T14:00:00.000Z',
    isCompleted: true,
    variables: { attendees: 500 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-06-15T14:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
  },
  {
    id: 'event-2',
    campaignId: 'campaign-1',
    locationId: 'location-2',
    name: 'Harvest Moon',
    description: null,
    eventType: 'world',
    scheduledAt: '2024-08-20T18:00:00.000Z',
    occurredAt: null,
    isCompleted: false,
    variables: {},
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
  },
];

// Reduced to 2 essential encounters for memory efficiency
export const mockEncounters = [
  {
    id: 'encounter-1',
    campaignId: 'campaign-1',
    locationId: 'location-1',
    name: 'Dragon Attack',
    description: null,
    difficulty: 15,
    scheduledAt: '2024-05-10T14:00:00.000Z',
    isResolved: true,
    resolvedAt: '2024-05-10T16:30:00.000Z',
    variables: { casualties: 12 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-05-10T16:30:00.000Z',
    deletedAt: null,
    archivedAt: null,
  },
  {
    id: 'encounter-2',
    campaignId: 'campaign-1',
    locationId: 'location-2',
    name: 'Dragon Sighting',
    description: null,
    difficulty: 15,
    scheduledAt: '2024-07-15T09:00:00.000Z',
    isResolved: false,
    resolvedAt: null,
    variables: {},
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    archivedAt: null,
  },
];

// Reduced to 3 essential settlements for memory efficiency
export const mockSettlements = [
  {
    id: 'settlement-1',
    kingdomId: 'kingdom-1',
    locationId: 'location-1',
    campaignId: 'campaign-1',
    ownerId: 'user-1',
    name: 'Ironhold',
    level: 3,
    x: 100,
    y: 150,
    z: 0,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      population: 1500,
      defense: 25,
    },
    variables: {
      prosperity: 75,
      has_walls: true,
    },
    variableSchemas: [
      { name: 'prosperity', type: 'number' },
      { name: 'has_walls', type: 'boolean' },
    ],
  },
  {
    id: 'settlement-2',
    kingdomId: 'kingdom-1',
    locationId: 'location-2',
    campaignId: 'campaign-1',
    ownerId: 'user-1',
    name: 'Silverkeep',
    level: 2,
    x: 200,
    y: 250,
    z: 0,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-02T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      population: 800,
    },
    variableSchemas: [],
  },
  {
    id: 'settlement-empty',
    kingdomId: 'kingdom-3',
    locationId: 'location-4',
    campaignId: 'campaign-1',
    ownerId: 'user-1',
    name: 'Empty Settlement',
    level: 1,
    x: 50,
    y: 50,
    z: 0,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-04T00:00:00.000Z',
    updatedAt: '2024-01-04T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {},
    variables: {},
    variableSchemas: [],
  },
];

// Reduced to 3 essential structures for memory efficiency
export const mockStructures = [
  {
    id: 'structure-1',
    settlementId: 'settlement-1',
    typeId: 'barracks',
    type: 'barracks',
    name: 'Main Barracks',
    level: 1,
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
    },
    variables: {
      garrison_size: 50,
    },
    variableSchemas: [{ name: 'garrison_size', type: 'number' }],
  },
  {
    id: 'structure-2',
    settlementId: 'settlement-1',
    typeId: 'marketplace',
    type: 'marketplace',
    name: 'Central Market',
    level: 2,
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
    },
    variableSchemas: [],
  },
  {
    id: 'structure-3',
    settlementId: 'settlement-1',
    typeId: 'library',
    type: 'library',
    name: 'Grand Library',
    level: 1,
    x: 50,
    y: 60,
    orientation: 270,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      knowledge: 75,
    },
    variableSchemas: [],
  },
  {
    id: 'structure-4',
    settlementId: 'settlement-2',
    typeId: 'marketplace',
    type: 'marketplace',
    name: 'Trader Post',
    level: 1,
    x: 15,
    y: 25,
    orientation: 0,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      trade_bonus: 0.1,
    },
    variableSchemas: [],
  },
  {
    id: 'structure-5',
    settlementId: 'settlement-3',
    typeId: 'barracks',
    type: 'barracks',
    name: 'Ruins of Old Fort',
    level: 0,
    x: 20,
    y: 30,
    orientation: 180,
    isArchived: false,
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    computedFields: {
      capacity: 0,
    },
    variableSchemas: [],
  },
];

/**
 * Mock dependency graph data
 *
 * Realistic test data representing a dependency graph with variables,
 * conditions, effects, and entities with various relationship types.
 */
export const mockDependencyGraph = {
  nodes: [
    {
      id: 'VARIABLE:var-population',
      type: 'VARIABLE' as const,
      entityId: 'var-population',
      label: 'settlement.population',
      metadata: {
        entityType: 'Settlement',
        fieldName: 'population',
      },
    },
    {
      id: 'VARIABLE:var-defense',
      type: 'VARIABLE' as const,
      entityId: 'var-defense',
      label: 'settlement.defense',
      metadata: {
        entityType: 'Settlement',
        fieldName: 'defense',
      },
    },
    {
      id: 'CONDITION:cond-is-large',
      type: 'CONDITION' as const,
      entityId: 'cond-is-large',
      label: 'Is Large Settlement',
      metadata: {
        expression: { '>': [{ var: 'settlement.population' }, 1000] },
        priority: 10,
      },
    },
    {
      id: 'CONDITION:cond-is-fortified',
      type: 'CONDITION' as const,
      entityId: 'cond-is-fortified',
      label: 'Is Fortified',
      metadata: {
        expression: { '>': [{ var: 'settlement.defense' }, 20] },
        priority: 5,
      },
    },
    {
      id: 'EFFECT:effect-boost-population',
      type: 'EFFECT' as const,
      entityId: 'effect-boost-population',
      label: 'Boost Population',
      metadata: {
        phase: 'ON_RESOLVE',
        operations: [
          {
            op: 'add',
            path: '/computedFields/population',
            value: 100,
          },
        ],
      },
    },
    {
      id: 'EFFECT:effect-boost-defense',
      type: 'EFFECT' as const,
      entityId: 'effect-boost-defense',
      label: 'Boost Defense',
      metadata: {
        phase: 'ON_RESOLVE',
        operations: [
          {
            op: 'add',
            path: '/computedFields/defense',
            value: 5,
          },
        ],
      },
    },
    {
      id: 'ENTITY:settlement-1',
      type: 'ENTITY' as const,
      entityId: 'settlement-1',
      label: 'Ironhold',
      metadata: {
        entityType: 'Settlement',
        name: 'Ironhold',
      },
    },
  ],
  edges: [
    {
      fromId: 'CONDITION:cond-is-large',
      toId: 'VARIABLE:var-population',
      type: 'READS' as const,
      metadata: {
        fieldPath: 'settlement.population',
      },
    },
    {
      fromId: 'CONDITION:cond-is-fortified',
      toId: 'VARIABLE:var-defense',
      type: 'READS' as const,
      metadata: {
        fieldPath: 'settlement.defense',
      },
    },
    {
      fromId: 'EFFECT:effect-boost-population',
      toId: 'VARIABLE:var-population',
      type: 'WRITES' as const,
      metadata: {
        operation: 'add',
        path: '/computedFields/population',
      },
    },
    {
      fromId: 'EFFECT:effect-boost-defense',
      toId: 'VARIABLE:var-defense',
      type: 'WRITES' as const,
      metadata: {
        operation: 'add',
        path: '/computedFields/defense',
      },
    },
    {
      fromId: 'EFFECT:effect-boost-defense',
      toId: 'CONDITION:cond-is-fortified',
      type: 'DEPENDS_ON' as const,
      metadata: {
        description: 'Effect depends on condition evaluation',
      },
    },
    {
      fromId: 'ENTITY:settlement-1',
      toId: 'VARIABLE:var-population',
      type: 'DEPENDS_ON' as const,
      metadata: {
        description: 'Entity has variable field',
      },
    },
    {
      fromId: 'ENTITY:settlement-1',
      toId: 'VARIABLE:var-defense',
      type: 'DEPENDS_ON' as const,
      metadata: {
        description: 'Entity has variable field',
      },
    },
  ],
  stats: {
    nodeCount: 7,
    edgeCount: 7,
    variableCount: 2,
    conditionCount: 2,
    effectCount: 2,
    entityCount: 1,
  },
  campaignId: 'campaign-1',
  branchId: 'main',
  builtAt: '2024-01-01T00:00:00.000Z',
};

// Mock conditions with descriptions and count matching test expectations
export const mockConditions = [
  {
    id: 'condition-1',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    field: 'is_trade_hub',
    expression: { '>=': [{ var: 'level' }, 3] },
    description: 'Applies when settlement level is 3 or higher',
    isActive: true,
    priority: 10,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  },
  {
    id: 'condition-2',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    field: 'is_fortified',
    expression: { '>=': [{ var: 'defense' }, 30] },
    description: 'Applies when defense rating is 30 or higher',
    isActive: true,
    priority: 20,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  },
  {
    id: 'condition-3',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    field: 'has_market',
    expression: {
      and: [{ '>=': [{ var: 'population' }, 1000] }, { '>=': [{ var: 'wealth' }, 5000] }],
    },
    description: 'Applies when population is 1000+ and wealth is 5000+',
    isActive: true,
    priority: 5,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  },
  {
    id: 'condition-4',
    entityType: 'Structure',
    entityId: 'structure-1',
    field: 'is_operational',
    expression: { '>=': [{ var: 'condition' }, 50] },
    description: 'Applies when structure condition is 50% or higher',
    isActive: true,
    priority: 10,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    createdBy: 'user-1',
    updatedBy: null,
  },
];

// Reduced to 2 essential effects for memory efficiency
export const mockEffects = [
  {
    id: 'effect-1',
    name: 'Boost Population',
    description: 'Increases settlement population by 100',
    effectType: 'patch',
    payload: [
      {
        op: 'add',
        path: '/variables/population',
        value: 100,
      },
    ],
    entityType: 'event',
    entityId: 'event-1',
    timing: 'ON_RESOLVE',
    priority: 10,
    isActive: true,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    executions: [
      {
        id: 'execution-1',
        effectId: 'effect-1',
        executedAt: '2024-06-15T14:00:00.000Z',
        status: 'SUCCESS',
        patchApplied: [
          {
            op: 'add',
            path: '/variables/population',
            value: 100,
          },
        ],
        error: null,
      },
    ],
  },
  {
    id: 'effect-2',
    name: 'Boost Defense',
    description: 'Increases settlement defense by 10',
    effectType: 'patch',
    payload: [
      {
        op: 'add',
        path: '/variables/defense',
        value: 10,
      },
    ],
    entityType: 'event',
    entityId: 'event-1',
    timing: 'POST',
    priority: 20,
    isActive: true,
    version: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
    executions: [],
  },
];

// Audit log entries for testing version history and audit tracking
// Now includes 8 entries covering Settlement, Structure, Event, and Encounter operations
export const mockAudits = [
  {
    id: 'audit-1',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    operation: 'CREATE',
    userId: 'user-1',
    changes: {
      name: 'Ironhold',
      level: 3,
      kingdomId: 'kingdom-1',
      locationId: 'location-1',
      ownerId: 'owner-1',
      x: 100,
      y: 150,
      z: 0,
      isArchived: false,
    },
    metadata: {
      ipAddress: '192.168.1.1',
    },
    timestamp: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'audit-2',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    operation: 'UPDATE',
    userId: 'user-1',
    changes: {
      level: {
        before: 3,
        after: 4,
      },
    },
    metadata: {
      ipAddress: '192.168.1.1',
    },
    timestamp: '2024-06-15T10:30:00.000Z',
  },
  {
    id: 'audit-3',
    entityType: 'Event',
    entityId: 'event-1',
    operation: 'UPDATE',
    userId: 'user-1',
    changes: {
      isCompleted: {
        before: false,
        after: true,
      },
      occurredAt: {
        before: null,
        after: '2024-08-01T14:30:00.000Z',
      },
    },
    metadata: {
      ipAddress: '192.168.1.1',
      effectsExecuted: 6,
      totalEffects: 6,
      effectExecutionSummary: {
        pre: {
          total: 2,
          succeeded: 2,
          failed: 0,
        },
        onResolve: {
          total: 3,
          succeeded: 3,
          failed: 0,
        },
        post: {
          total: 1,
          succeeded: 1,
          failed: 0,
        },
      },
    },
    timestamp: '2024-08-01T14:30:00.000Z',
  },
  {
    id: 'audit-2a',
    entityType: 'Settlement',
    entityId: 'settlement-1',
    operation: 'UPDATE',
    userId: 'user-2',
    changes: {
      name: {
        before: 'Ironhold',
        after: 'New Ironhold',
      },
    },
    metadata: {
      ipAddress: '192.168.1.2',
    },
    timestamp: '2024-07-01T12:00:00.000Z',
  },
  {
    id: 'audit-structure-1',
    entityType: 'Structure',
    entityId: 'structure-1',
    operation: 'CREATE',
    userId: 'user-1',
    changes: {
      settlementId: 'settlement-1',
      type: 'barracks',
      name: 'Main Barracks',
      level: 1,
      x: 10,
      y: 20,
      orientation: 0,
      isArchived: false,
    },
    metadata: {
      ipAddress: '192.168.1.1',
    },
    timestamp: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'audit-structure-1a',
    entityType: 'Structure',
    entityId: 'structure-1',
    operation: 'UPDATE',
    userId: 'user-1',
    changes: {
      level: {
        before: 1,
        after: 2,
      },
    },
    metadata: {
      ipAddress: '192.168.1.1',
    },
    timestamp: '2024-03-01T00:00:00.000Z',
  },
  {
    id: 'audit-event-2',
    entityType: 'Event',
    entityId: 'event-2',
    operation: 'UPDATE',
    userId: 'user-1',
    changes: {
      isCompleted: {
        before: false,
        after: true,
      },
      occurredAt: {
        before: null,
        after: '2024-09-01T10:00:00.000Z',
      },
    },
    metadata: {
      ipAddress: '192.168.1.1',
      effectsExecuted: 0,
      totalEffects: 0,
    },
    timestamp: '2024-09-01T10:00:00.000Z',
  },
  {
    id: 'audit-encounter-1',
    entityType: 'Encounter',
    entityId: 'encounter-1',
    operation: 'UPDATE',
    userId: 'user-1',
    changes: {
      isResolved: {
        before: false,
        after: true,
      },
      resolvedAt: {
        before: null,
        after: '2024-10-01T15:00:00.000Z',
      },
    },
    metadata: {
      ipAddress: '192.168.1.1',
      effectsExecuted: 3,
      totalEffects: 4,
      effectExecutionSummary: {
        pre: {
          total: 1,
          succeeded: 1,
          failed: 0,
        },
        onResolve: {
          total: 2,
          succeeded: 1,
          failed: 1,
        },
        post: {
          total: 1,
          succeeded: 1,
          failed: 0,
        },
      },
    },
    timestamp: '2024-10-01T15:00:00.000Z',
  },
];

/**
 * Mock version data for version history testing
 */
// Reduced to 3 essential versions for memory efficiency
export const mockVersions = [
  {
    id: 'version-1',
    entityType: 'settlement',
    entityId: 'settlement-1',
    branchId: 'branch-1',
    validFrom: '2024-06-15T14:00:00.000Z',
    validTo: null,
    payload: { name: 'Ironhold', level: 3 },
    version: 3,
    comment: 'Upgraded to level 3',
    createdBy: 'user-1',
    createdAt: '2024-06-15T14:00:00.000Z',
  },
  {
    id: 'version-2',
    entityType: 'settlement',
    entityId: 'settlement-1',
    branchId: 'branch-1',
    validFrom: '2024-06-10T10:00:00.000Z',
    validTo: '2024-06-15T14:00:00.000Z',
    payload: { name: 'Ironhold', level: 2 },
    version: 2,
    comment: 'Upgraded to level 2',
    createdBy: 'user-2',
    createdAt: '2024-06-10T10:00:00.000Z',
  },
  {
    id: 'version-3',
    entityType: 'settlement',
    entityId: 'settlement-1',
    branchId: 'branch-1',
    validFrom: '2024-06-01T08:00:00.000Z',
    validTo: '2024-06-10T10:00:00.000Z',
    payload: { name: 'Ironhold', level: 1 },
    version: 1,
    comment: 'Initial creation',
    createdBy: 'user-1',
    createdAt: '2024-06-01T08:00:00.000Z',
  },
];

/**
 * Mock branch data for branching system testing
 */
export const mockBranches = [
  {
    id: 'main',
    name: 'Main Timeline',
    description: 'Primary campaign timeline',
    campaignId: 'campaign-1',
    parentId: null,
    parent: null,
    divergedAt: null,
    isPinned: true,
    color: '#3b82f6',
    tags: ['primary'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'branch-1',
    name: 'Alternate Branch',
    description: 'Alternative timeline branch',
    campaignId: 'campaign-1',
    parentId: 'main',
    parent: {
      id: 'main',
      name: 'Main Timeline',
    },
    divergedAt: '2024-06-01T00:00:00.000Z',
    isPinned: false,
    color: '#10b981',
    tags: ['alternate'],
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
    deletedAt: null,
  },
  {
    id: 'branch-2',
    name: 'Experimental Branch',
    description: 'Experimental what-if scenario',
    campaignId: 'campaign-1',
    parentId: 'branch-1',
    parent: {
      id: 'branch-1',
      name: 'Alternate Branch',
    },
    divergedAt: '2024-07-01T00:00:00.000Z',
    isPinned: false,
    color: '#f59e0b',
    tags: ['experimental', 'test'],
    createdAt: '2024-07-01T00:00:00.000Z',
    updatedAt: '2024-07-01T00:00:00.000Z',
    deletedAt: null,
  },
];

/**
 * Mock branch hierarchy data for tree structure testing
 */
export const mockBranchHierarchy = [
  {
    branch: {
      id: 'main',
      name: 'Main Timeline',
      description: 'Primary campaign timeline',
      divergedAt: null,
      isPinned: true,
      color: '#3b82f6',
      tags: ['primary'],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    children: [
      {
        branch: {
          id: 'branch-1',
          name: 'Alternate Branch',
          description: 'Alternative timeline branch',
          divergedAt: '2024-06-01T00:00:00.000Z',
          isPinned: false,
          color: '#10b981',
          tags: ['alternate'],
          createdAt: '2024-06-01T00:00:00.000Z',
          updatedAt: '2024-06-01T00:00:00.000Z',
        },
        children: [
          {
            branch: {
              id: 'branch-2',
              name: 'Experimental Branch',
              divergedAt: '2024-07-01T00:00:00.000Z',
              isPinned: false,
              color: '#f59e0b',
              tags: ['experimental', 'test'],
            },
            children: [
              {
                branch: {
                  id: 'branch-3',
                  name: 'Nested Branch',
                  isPinned: false,
                  color: '#8b5cf6',
                  tags: [],
                },
              },
            ],
          },
        ],
      },
    ],
  },
];
