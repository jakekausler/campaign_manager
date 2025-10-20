/**
 * MSW GraphQL request handlers
 *
 * Defines mock responses for GraphQL queries and mutations used in tests.
 * Handlers can be overridden per-test using server.use() for specific scenarios.
 */

import { graphql, HttpResponse } from 'msw';

import {
  mockSettlements,
  mockStructures,
  mockEvents,
  mockEncounters,
  mockDependencyGraph,
  mockConditions,
  mockEffects,
} from './data';

export const graphqlHandlers = [
  // Settlement Queries
  graphql.query('GetSettlementsByKingdom', ({ variables }) => {
    const { kingdomId } = variables as { kingdomId: string };
    const settlements = mockSettlements.filter((s) => s.kingdomId === kingdomId);
    return HttpResponse.json({
      data: { settlementsByKingdom: settlements },
    });
  }),

  graphql.query('GetSettlementDetails', ({ variables }) => {
    const { id } = variables as { id: string };

    // Simulate server error for "invalid-*" IDs
    if (id.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Internal server error' }],
      });
    }

    // Return error for entities that don't exist
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) {
      return HttpResponse.json({
        errors: [{ message: 'Settlement not found' }],
      });
    }

    return HttpResponse.json({
      data: { settlement },
    });
  }),

  graphql.query('GetSettlementStructures', ({ variables }) => {
    const { id } = variables as { id: string };

    // Simulate structures query error for specific test case
    if (id === 'settlement-error-structures') {
      const settlement = mockSettlements.find((s) => s.id === 'settlement-1');
      return HttpResponse.json({
        errors: [{ message: 'Failed to fetch structures' }],
        data: { settlement }, // Return settlement but with error for structures
      });
    }

    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) {
      return HttpResponse.json({
        errors: [{ message: 'Settlement not found' }],
      });
    }
    const structures = mockStructures.filter((st) => st.settlementId === id);
    return HttpResponse.json({
      data: { settlement: { ...settlement, structures } },
    });
  }),

  // Structure Queries
  graphql.query('GetStructureDetails', ({ variables }) => {
    const { id } = variables as { id: string };

    // Simulate server error for "invalid-*" IDs
    if (id.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Internal server error' }],
      });
    }

    // Return error for entities that don't exist
    const structure = mockStructures.find((s) => s.id === id);
    if (!structure) {
      return HttpResponse.json({
        errors: [{ message: 'Structure not found' }],
      });
    }

    return HttpResponse.json({
      data: { structure },
    });
  }),

  graphql.query('GetStructureConditions', ({ variables }) => {
    const { id } = variables as { id: string };
    const structure = mockStructures.find((s) => s.id === id);
    if (!structure) {
      return HttpResponse.json({
        errors: [{ message: 'Structure not found' }],
      });
    }
    return HttpResponse.json({
      data: { structure },
    });
  }),

  // Dependency Graph Queries
  graphql.query('GetDependencyGraph', ({ variables }) => {
    const { campaignId, branchId = 'main' } = variables as {
      campaignId: string;
      branchId?: string;
    };

    // Return mock data for campaign-1, error for others
    if (campaignId !== 'campaign-1') {
      return HttpResponse.json({
        errors: [{ message: 'Campaign not found' }],
      });
    }

    // Return graph with updated branchId and timestamp
    return HttpResponse.json({
      data: {
        getDependencyGraph: {
          ...mockDependencyGraph,
          campaignId,
          branchId,
          builtAt: new Date().toISOString(),
        },
      },
    });
  }),

  // Event Queries
  graphql.query('GetEventsByCampaign', ({ variables }) => {
    const { campaignId } = variables as { campaignId: string };
    const events = mockEvents.filter((e) => e.campaignId === campaignId);
    return HttpResponse.json({
      data: { eventsByCampaign: events },
    });
  }),

  // Encounter Queries
  graphql.query('GetEncountersByCampaign', ({ variables }) => {
    const { campaignId } = variables as { campaignId: string };
    const encounters = mockEncounters.filter((e) => e.campaignId === campaignId);
    return HttpResponse.json({
      data: { encountersByCampaign: encounters },
    });
  }),

  // Settlement Mutations
  graphql.mutation('CreateSettlement', ({ variables }) => {
    const { input } = variables as { input: Record<string, unknown> };
    const newSettlement = {
      id: `settlement-${Date.now()}`,
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      version: 1,
      computedFields: {},
    };
    return HttpResponse.json({
      data: { createSettlement: newSettlement },
    });
  }),

  graphql.mutation('UpdateSettlement', ({ variables }) => {
    const { id, input } = variables as { id: string; input: Record<string, unknown> };
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) {
      return HttpResponse.json({
        errors: [{ message: 'Settlement not found' }],
      });
    }
    const updated = {
      ...settlement,
      ...input,
      updatedAt: new Date().toISOString(),
      version: settlement.version + 1,
    };
    return HttpResponse.json({
      data: { updateSettlement: updated },
    });
  }),

  graphql.mutation('DeleteSettlement', ({ variables }) => {
    const { id } = variables as { id: string };
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) {
      return HttpResponse.json({
        errors: [{ message: 'Settlement not found' }],
      });
    }
    const deleted = {
      id: settlement.id,
      deletedAt: new Date().toISOString(),
      version: settlement.version + 1,
    };
    return HttpResponse.json({
      data: { deleteSettlement: deleted },
    });
  }),

  graphql.mutation('ArchiveSettlement', ({ variables }) => {
    const { id } = variables as { id: string };
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) {
      return HttpResponse.json({
        errors: [{ message: 'Settlement not found' }],
      });
    }
    const archived = {
      ...settlement,
      deletedAt: new Date().toISOString(),
      version: settlement.version + 1,
    };
    return HttpResponse.json({
      data: { archiveSettlement: archived },
    });
  }),

  graphql.mutation('RestoreSettlement', ({ variables }) => {
    const { id } = variables as { id: string };
    const settlement = mockSettlements.find((s) => s.id === id);
    if (!settlement) {
      return HttpResponse.json({
        errors: [{ message: 'Settlement not found' }],
      });
    }
    const restored = {
      ...settlement,
      deletedAt: null,
      version: settlement.version + 1,
    };
    return HttpResponse.json({
      data: { restoreSettlement: restored },
    });
  }),

  // Structure Mutations
  graphql.mutation('CreateStructure', ({ variables }) => {
    const { input } = variables as { input: Record<string, unknown> };
    const newStructure = {
      id: `structure-${Date.now()}`,
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      version: 1,
      computedFields: {},
    };
    return HttpResponse.json({
      data: { createStructure: newStructure },
    });
  }),

  graphql.mutation('UpdateStructure', ({ variables }) => {
    const { id, input } = variables as { id: string; input: Record<string, unknown> };
    const structure = mockStructures.find((s) => s.id === id);
    if (!structure) {
      return HttpResponse.json({
        errors: [{ message: 'Structure not found' }],
      });
    }
    const updated = {
      ...structure,
      ...input,
      updatedAt: new Date().toISOString(),
      version: structure.version + 1,
    };
    return HttpResponse.json({
      data: { updateStructure: updated },
    });
  }),

  graphql.mutation('DeleteStructure', ({ variables }) => {
    const { id } = variables as { id: string };
    const structure = mockStructures.find((s) => s.id === id);
    if (!structure) {
      return HttpResponse.json({
        errors: [{ message: 'Structure not found' }],
      });
    }
    const deleted = {
      id: structure.id,
      deletedAt: new Date().toISOString(),
      version: structure.version + 1,
    };
    return HttpResponse.json({
      data: { deleteStructure: deleted },
    });
  }),

  graphql.mutation('ArchiveStructure', ({ variables }) => {
    const { id } = variables as { id: string };
    const structure = mockStructures.find((s) => s.id === id);
    if (!structure) {
      return HttpResponse.json({
        errors: [{ message: 'Structure not found' }],
      });
    }
    const archived = {
      ...structure,
      deletedAt: new Date().toISOString(),
      version: structure.version + 1,
    };
    return HttpResponse.json({
      data: { archiveStructure: archived },
    });
  }),

  graphql.mutation('RestoreStructure', ({ variables }) => {
    const { id } = variables as { id: string };
    const structure = mockStructures.find((s) => s.id === id);
    if (!structure) {
      return HttpResponse.json({
        errors: [{ message: 'Structure not found' }],
      });
    }
    const restored = {
      ...structure,
      deletedAt: null,
      version: structure.version + 1,
    };
    return HttpResponse.json({
      data: { restoreStructure: restored },
    });
  }),

  // Condition Queries
  graphql.query('GetConditionsForEntity', ({ variables }) => {
    const { entityType, entityId, field } = variables as {
      entityType: string;
      entityId: string;
      field?: string | null;
    };

    // Error case
    if (entityId.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Failed to fetch conditions' }],
      });
    }

    // Empty case
    if (entityId.endsWith('-empty')) {
      return HttpResponse.json({
        data: { getConditionsForEntity: [] },
      });
    }

    let conditions = mockConditions.filter(
      (c) => c.entityType === entityType && (c.entityId === entityId || c.entityId === null) // Include type-level conditions
    );

    // Filter by field if provided
    if (field) {
      conditions = conditions.filter((c) => c.field === field);
    }

    return HttpResponse.json({
      data: { getConditionsForEntity: conditions },
    });
  }),

  graphql.query('EvaluateFieldCondition', ({ variables }) => {
    const { input } = variables as {
      input: {
        conditionId: string;
        context: Record<string, unknown>;
      };
    };

    const condition = mockConditions.find((c) => c.id === input.conditionId);
    if (!condition) {
      return HttpResponse.json({
        errors: [{ message: 'Condition not found' }],
      });
    }

    // Mock evaluation result
    // For simplicity, we'll just return a success result with mock trace
    const result = {
      value: true,
      success: true,
      trace: [
        {
          step: 1,
          operation: '>=',
          input: { left: input.context.level, right: 3 },
          output: true,
          description: 'Compare level >= 3',
        },
      ],
      error: null,
    };

    return HttpResponse.json({
      data: { evaluateFieldCondition: result },
    });
  }),

  // Effect Queries
  graphql.query('GetEffectsForEntity', ({ variables }) => {
    const { entityType, entityId, timing } = variables as {
      entityType: string;
      entityId: string;
      timing: string;
    };

    const effects = mockEffects.filter(
      (e) => e.entityType === entityType && e.entityId === entityId && e.timing === timing
    );

    return HttpResponse.json({
      data: { getEffectsForEntity: effects },
    });
  }),

  graphql.query('GetAllEffectsForEntity', ({ variables }) => {
    const { entityType, entityId } = variables as {
      entityType: string;
      entityId: string;
    };

    // Error case for invalid entity IDs
    if (entityId.startsWith('invalid-')) {
      return HttpResponse.json({
        errors: [{ message: 'Failed to fetch effects' }],
      });
    }

    // Empty case for entity IDs ending with -empty
    if (entityId.endsWith('-empty')) {
      return HttpResponse.json({
        data: {
          getEffectsForEntity: [],
          onResolve: [],
          post: [],
        },
      });
    }

    const preEffects = mockEffects.filter(
      (e) => e.entityType === entityType && e.entityId === entityId && e.timing === 'PRE'
    );

    const onResolveEffects = mockEffects.filter(
      (e) => e.entityType === entityType && e.entityId === entityId && e.timing === 'ON_RESOLVE'
    );

    const postEffects = mockEffects.filter(
      (e) => e.entityType === entityType && e.entityId === entityId && e.timing === 'POST'
    );

    return HttpResponse.json({
      data: {
        getEffectsForEntity: preEffects,
        onResolve: onResolveEffects,
        post: postEffects,
      },
    });
  }),
];
