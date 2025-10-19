/**
 * MSW GraphQL request handlers
 *
 * Defines mock responses for GraphQL queries and mutations used in tests.
 * Handlers can be overridden per-test using server.use() for specific scenarios.
 */

import { graphql, HttpResponse } from 'msw';

import { mockSettlements, mockStructures } from './data';

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
    return HttpResponse.json({
      data: { deleteSettlement: true },
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
    return HttpResponse.json({
      data: { deleteStructure: true },
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
];
