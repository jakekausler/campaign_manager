# TICKET-037: Settlement & Structure Rules Integration

## Status

- [ ] Completed
- **Commits**:

## Description

Integrate Settlement and Structure entities into the rules engine and JSONLogic expression system, enabling conditions and effects to reference Settlement/Structure properties, levels, and typed variables in rule evaluations.

## Scope of Work

1. Extend JSONLogic context with Settlement data:
   - Add `settlement` object to evaluation context
   - Include Settlement properties: id, name, level, kingdomId, locationId
   - Include Settlement typed variables
   - Include computed Settlement stats (structure count, average structure level)
2. Extend JSONLogic context with Structure data:
   - Add `structure` object to evaluation context
   - Include Structure properties: id, name, type, level, settlementId
   - Include Structure typed variables
   - Include Structure operational status
3. Add Settlement-specific JSONLogic operators:
   - `settlement.level` - Get settlement level
   - `settlement.var` - Get settlement typed variable value
   - `settlement.hasStructureType` - Check if settlement has structure of specific type
   - `settlement.structureCount` - Count structures (optionally filtered by type)
   - `settlement.inKingdom` - Check if settlement belongs to specific kingdom
   - `settlement.atLocation` - Check if settlement is at specific location
4. Add Structure-specific JSONLogic operators:
   - `structure.level` - Get structure level
   - `structure.type` - Get structure type
   - `structure.var` - Get structure typed variable value
   - `structure.isOperational` - Check if structure is operational
   - `structure.inSettlement` - Check if structure belongs to specific settlement
5. Create Settlement condition examples:
   - Settlement level thresholds
   - Settlement population requirements
   - Settlement structure composition (e.g., must have temple + market)
   - Settlement prosperity checks
6. Create Structure condition examples:
   - Structure level requirements
   - Structure type checks
   - Structure operational status
   - Structure variable thresholds (e.g., integrity > 80%)
7. Implement Settlement effects:
   - Set Settlement level
   - Update Settlement typed variables
   - Add/remove Structures
   - Change Settlement prosperity
8. Implement Structure effects:
   - Set Structure level
   - Update Structure typed variables
   - Change Structure operational status
   - Upgrade/downgrade Structure
9. Add Settlement/Structure to dependency graph:
   - Track dependencies on Settlement variables
   - Track dependencies on Structure variables
   - Invalidate dependent rules when Settlement/Structure state changes
10. Create validation for Settlement/Structure rules:
    - Validate Settlement references exist
    - Validate Structure references exist
    - Validate typed variable access matches schema
    - Prevent circular dependencies

## Acceptance Criteria

- [ ] Can reference settlement.level in conditions
- [ ] Can reference settlement.var('variableName') in conditions
- [ ] settlement.hasStructureType('temple') works correctly
- [ ] settlement.structureCount() returns correct count
- [ ] settlement.structureCount('barracks') filters by type correctly
- [ ] Can reference structure.level in conditions
- [ ] Can reference structure.type in conditions
- [ ] Can reference structure.var('variableName') in conditions
- [ ] structure.isOperational evaluates correctly
- [ ] Settlement conditions evaluate with correct context
- [ ] Structure conditions evaluate with correct context
- [ ] Settlement effects update state correctly
- [ ] Structure effects update state correctly
- [ ] Dependency graph tracks Settlement variable dependencies
- [ ] Dependency graph tracks Structure variable dependencies
- [ ] Rule invalidation works when Settlement state changes
- [ ] Rule invalidation works when Structure state changes
- [ ] Validation rejects invalid Settlement references
- [ ] Validation rejects invalid Structure references
- [ ] Validation rejects invalid typed variable access

## Technical Notes

### Settlement Context in Rules Engine

```typescript
interface SettlementContext {
  id: string;
  name: string;
  level: number;
  kingdomId: string;
  locationId: string;
  variables: Record<string, unknown>;
  structures: {
    count: number;
    byType: Record<string, number>;
    averageLevel: number;
  };
}

// Example evaluation context
const context = {
  world: { ... },
  campaign: { ... },
  party: { ... },
  settlement: {
    id: 'settlement-123',
    name: 'Riverside',
    level: 5,
    kingdomId: 'kingdom-456',
    locationId: 'location-789',
    variables: {
      population: 8500,
      prosperity: 'thriving',
      defenseRating: 7,
    },
    structures: {
      count: 12,
      byType: {
        temple: 2,
        barracks: 1,
        market: 3,
        library: 1,
        forge: 2,
        tavern: 3,
      },
      averageLevel: 4.2,
    },
  },
};
```

### JSONLogic Custom Operators for Settlements

```typescript
// Register custom operators
jsonLogic.add_operation('settlement.level', (settlementId?: string) => {
  const settlement = settlementId ? getSettlementById(settlementId) : context.settlement;
  return settlement?.level ?? 0;
});

jsonLogic.add_operation('settlement.var', (varName: string, settlementId?: string) => {
  const settlement = settlementId ? getSettlementById(settlementId) : context.settlement;
  return settlement?.variables[varName];
});

jsonLogic.add_operation(
  'settlement.hasStructureType',
  (structureType: string, settlementId?: string) => {
    const settlement = settlementId ? getSettlementById(settlementId) : context.settlement;
    return (settlement?.structures.byType[structureType] ?? 0) > 0;
  }
);

jsonLogic.add_operation(
  'settlement.structureCount',
  (structureType?: string, settlementId?: string) => {
    const settlement = settlementId ? getSettlementById(settlementId) : context.settlement;

    if (structureType) {
      return settlement?.structures.byType[structureType] ?? 0;
    }
    return settlement?.structures.count ?? 0;
  }
);

jsonLogic.add_operation('settlement.inKingdom', (kingdomId: string, settlementId?: string) => {
  const settlement = settlementId ? getSettlementById(settlementId) : context.settlement;
  return settlement?.kingdomId === kingdomId;
});

jsonLogic.add_operation('settlement.atLocation', (locationId: string, settlementId?: string) => {
  const settlement = settlementId ? getSettlementById(settlementId) : context.settlement;
  return settlement?.locationId === locationId;
});
```

### Structure Context and Operators

```typescript
interface StructureContext {
  id: string;
  name: string;
  type: string;
  level: number;
  settlementId: string;
  variables: Record<string, unknown>;
  operational: boolean;
}

// Structure operators
jsonLogic.add_operation('structure.level', (structureId?: string) => {
  const structure = structureId ? getStructureById(structureId) : context.structure;
  return structure?.level ?? 0;
});

jsonLogic.add_operation('structure.type', (structureId?: string) => {
  const structure = structureId ? getStructureById(structureId) : context.structure;
  return structure?.type;
});

jsonLogic.add_operation('structure.var', (varName: string, structureId?: string) => {
  const structure = structureId ? getStructureById(structureId) : context.structure;
  return structure?.variables[varName];
});

jsonLogic.add_operation('structure.isOperational', (structureId?: string) => {
  const structure = structureId ? getStructureById(structureId) : context.structure;
  return structure?.operational ?? false;
});

jsonLogic.add_operation('structure.inSettlement', (settlementId: string, structureId?: string) => {
  const structure = structureId ? getStructureById(structureId) : context.structure;
  return structure?.settlementId === settlementId;
});
```

### Example Settlement Conditions

```typescript
// Settlement level requirement
const settlementLevelCondition = {
  '>=': [{ 'settlement.level': [] }, 5],
};

// Settlement must have temple and market
const settlementStructureComposition = {
  and: [
    { 'settlement.hasStructureType': ['temple'] },
    { 'settlement.hasStructureType': ['market'] },
  ],
};

// Settlement population threshold
const settlementPopulationCheck = {
  '>': [{ 'settlement.var': ['population'] }, 10000],
};

// Settlement has at least 2 barracks
const settlementBarracksCount = {
  '>=': [{ 'settlement.structureCount': ['barracks'] }, 2],
};

// Combined condition: thriving settlement with defenses
const thrivingDefendedSettlement = {
  and: [
    { '>=': [{ 'settlement.level': [] }, 5] },
    { '==': [{ 'settlement.var': ['prosperity'] }, 'thriving'] },
    { '>=': [{ 'settlement.var': ['defenseRating'] }, 7] },
    { 'settlement.hasStructureType': ['barracks'] },
  ],
};
```

### Example Structure Conditions

```typescript
// Structure level requirement
const structureLevelCondition = {
  '>=': [{ 'structure.level': [] }, 3],
};

// Structure type check
const isTemple = {
  '==': [{ 'structure.type': [] }, 'temple'],
};

// Structure integrity threshold
const structureIntegrityCheck = {
  '>': [{ 'structure.var': ['integrity'] }, 80],
};

// Structure is operational
const structureOperational = {
  'structure.isOperational': [],
};

// Combined: operational high-level temple
const operationalHighLevelTemple = {
  and: [
    { '==': [{ 'structure.type': [] }, 'temple'] },
    { '>=': [{ 'structure.level': [] }, 5] },
    { 'structure.isOperational': [] },
    { '>': [{ 'structure.var': ['integrity'] }, 90] },
  ],
};
```

### Settlement Effects

```typescript
// Effect to increase settlement level
const increaseSettlementLevel = {
  type: 'settlement.setLevel',
  settlementId: 'settlement-123',
  level: { '+': [{ 'settlement.level': [] }, 1] },
};

// Effect to update settlement variable
const updateSettlementPopulation = {
  type: 'settlement.setVariable',
  settlementId: 'settlement-123',
  variable: 'population',
  value: { '+': [{ 'settlement.var': ['population'] }, 500] },
};

// Effect to add structure
const addStructure = {
  type: 'settlement.addStructure',
  settlementId: 'settlement-123',
  structure: {
    type: 'temple',
    name: 'Temple of Light',
    level: 1,
  },
};
```

### Dependency Graph Integration

```typescript
// Track Settlement variable dependencies
class DependencyGraphBuilder {
  extractSettlementDependencies(rule: JSONLogicRule): string[] {
    const dependencies: string[] = [];

    this.traverse(rule, (node) => {
      if (node['settlement.var']) {
        const varName = node['settlement.var'][0];
        dependencies.push(`settlement.${varName}`);
      }
      if (node['settlement.level']) {
        dependencies.push('settlement.level');
      }
      if (node['settlement.structureCount']) {
        dependencies.push('settlement.structures.count');
      }
    });

    return dependencies;
  }

  extractStructureDependencies(rule: JSONLogicRule): string[] {
    const dependencies: string[] = [];

    this.traverse(rule, (node) => {
      if (node['structure.var']) {
        const varName = node['structure.var'][0];
        dependencies.push(`structure.${varName}`);
      }
      if (node['structure.level']) {
        dependencies.push('structure.level');
      }
      if (node['structure.type']) {
        dependencies.push('structure.type');
      }
    });

    return dependencies;
  }
}
```

## Architectural Decisions

- **Context scoping**: Settlement and Structure contexts separate from other entity contexts
- **Operator naming**: Consistent `entity.property` pattern for all operators
- **Default behavior**: Operators work on current context entity if no ID provided
- **Cross-entity queries**: Support querying other settlements/structures by ID
- **Type safety**: Validate typed variable access against schemas
- **Performance**: Cache Settlement/Structure data during evaluation batch
- **Dependency tracking**: Automatic dependency extraction from JSONLogic rules
- **Invalidation**: Fine-grained invalidation based on specific variable changes

## Dependencies

- Requires: TICKET-011 (JSONLogic Expression Parser)
- Requires: TICKET-013 (State Variable System)
- Requires: TICKET-014 (Dependency Graph Builder)
- Requires: TICKET-009 (Party & Kingdom Management with Settlement/Structure)

## Testing Requirements

- [ ] settlement.level operator returns correct value
- [ ] settlement.var operator retrieves typed variables
- [ ] settlement.hasStructureType detects structure presence
- [ ] settlement.structureCount counts correctly
- [ ] settlement.structureCount filters by type
- [ ] structure.level operator returns correct value
- [ ] structure.type operator returns correct type
- [ ] structure.var operator retrieves typed variables
- [ ] structure.isOperational evaluates correctly
- [ ] Complex Settlement conditions evaluate correctly
- [ ] Complex Structure conditions evaluate correctly
- [ ] Settlement effects execute successfully
- [ ] Structure effects execute successfully
- [ ] Dependency graph extracts Settlement dependencies
- [ ] Dependency graph extracts Structure dependencies
- [ ] Rule invalidation triggers on Settlement level change
- [ ] Rule invalidation triggers on Settlement variable change
- [ ] Rule invalidation triggers on Structure level change
- [ ] Rule invalidation triggers on Structure variable change
- [ ] Invalid Settlement references are rejected
- [ ] Invalid Structure references are rejected

## Related Tickets

- Requires: TICKET-009, TICKET-011, TICKET-013, TICKET-014
- Related: TICKET-015 (Rules Engine Worker), TICKET-030 (Visual Rule Builder)

## Estimated Effort

4-5 days
