# TICKET-011: JSONLogic Expression Parser

## Status

- [ ] Completed
- **Commits**:
  - 48cb512 - Implementation plan created
  - ea4f328 - Stage 1 complete (Core JSONLogic Integration & Setup)

## Implementation Notes

Implementation plan created in TICKET-011-implementation-plan.md with 5 stages.

### Stage 1: Core JSONLogic Integration & Setup ✅ COMPLETE

**Commit**: ea4f328

**Completed**:

- Added json-logic-js and @types/json-logic-js dependencies to @campaign/api
- Created packages/api/src/rules/ directory structure
- Implemented expression.types.ts with type definitions:
  - Expression (JSONLogic AST)
  - EvaluationContext (data context for variables)
  - EvaluationResult (type-safe result with success/error handling)
  - ParseOptions/EvaluateOptions (marked @internal for future stages)
- Implemented ExpressionParserService with:
  - parse() method: Pass-through with null/undefined validation
  - evaluate() method: Wraps json-logic-js with error handling and logging
- Security improvements:
  - Sanitized error logging (logs context keys only, not sensitive values)
  - Basic input validation to prevent null/undefined expressions
- Comprehensive test coverage: 31 tests passing
  - All standard JSONLogic operators (comparison, logical, array, conditional, arithmetic)
  - Variable access (top-level, nested, missing, defaults)
  - Complex nested expressions
  - Error handling and input validation

**Test Results**: All 31 tests passing
**Type-check**: ✅ Pass
**Lint**: ✅ Pass (0 errors)

**Next Stage**: Stage 2 - Custom Operator Framework & Spatial Operators

## Description

Implement a safe JSONLogic-based expression parser with custom domain operators for evaluating conditional rules.

## Scope of Work

1. Integrate JSONLogic library
2. Extend with custom operators (spatial, temporal, domain-specific)
3. Create expression validator
4. Implement sandbox execution
5. Add expression caching

## Acceptance Criteria

- [ ] Can parse and evaluate JSONLogic expressions
- [ ] Custom operators work (inside, distanceFrom, daysSince, etc.)
- [ ] Validation catches malformed expressions
- [ ] Expressions execute safely (no code injection)
- [ ] Expression AST is cached for performance

## Technical Notes

```typescript
const customOperators = {
  inside: (locationId, regionId) => this.spatial.pointInRegion(locationId, regionId),
  distanceFrom: (targetId) => this.spatial.distance(context.location, targetId),
  daysSince: (eventPath) => this.temporal.daysSince(context.worldTime, eventPath),
};
```

## Dependencies

- Requires: TICKET-007

## Estimated Effort

3-4 days
