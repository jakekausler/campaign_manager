# TICKET-011: JSONLogic Expression Parser

## Status

- [ ] Completed
- **Commits**:
  - 48cb512 - Implementation plan created
  - ea4f328 - Stage 1 complete (Core JSONLogic Integration & Setup)
  - 9ad4ae4 - Stage 2 complete (Custom Operator Framework & Spatial Operators)
  - 21fa7a8 - Stage 3 complete (Temporal Operators & Expression Validation)
  - e4eeeb7 - Stage 4 complete (Sandbox Execution & Security)

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

### Stage 2: Custom Operator Framework & Spatial Operators ✅ COMPLETE

**Commit**: 9ad4ae4

**Completed**:

- Added CustomOperator and CustomOperatorFunction types to expression.types.ts
- Created OperatorRegistry class with full CRUD operations for custom operators:
  - register(): Add operators with duplicate prevention
  - get/has/getAll(): Query registered operators
  - unregister/clear(): Remove operators
  - getOperatorMap(): Get JSONLogic-compatible operator map (for json-logic-js integration)
- Integrated OperatorRegistry into ExpressionParserService via dependency injection
  - Constructor injection of OperatorRegistry
  - Dynamic operator registration before each evaluation using add_operation()
- Implemented spatial operators with factory pattern:
  - createInsideOperator(): Point-in-region spatial queries
  - createDistanceFromOperator(): Distance calculations
  - Both use ISpatialService interface for abstraction
  - Type validation and safe defaults (false/null on invalid input)
- Created MockSpatialService for testing:
  - Simple bounding box logic for point-in-region
  - Euclidean distance calculation
  - Test data management (addLocation, addRegion, clear)
- Created RulesModule for proper NestJS dependency injection:
  - Registered ExpressionParserService and OperatorRegistry as singleton providers
  - Exported both services for use in other modules
  - Encapsulates Rules Engine subsystem
- Comprehensive test coverage:
  - OperatorRegistry: 15 tests (all registration/retrieval/removal scenarios)
  - Spatial Operators: 18 tests (edge cases, invalid inputs, type guards)
  - ExpressionParserService: 4 new integration tests (custom operator usage)
  - RulesModule: 6 tests (dependency injection and exports)
  - Total: 43 new tests, all passing

**Test Results**: All 651 tests passing (43 new)
**Type-check**: ✅ Pass
**Lint**: ✅ Pass (0 errors)

**Architecture Decisions**:

- Factory pattern for operator creation enables dependency injection of services
- Interface-based ISpatialService ready for future PostGIS implementation (TICKET-012+)
- Registry pattern allows dynamic operator management at runtime
- Module exports enable future integration with Rules Engine (Stage 3+)
- Singleton scope for services ensures consistent state across application

**Next Stage**: Stage 3 - Temporal Operators & Expression Validation

### Stage 3: Temporal Operators & Expression Validation ✅ COMPLETE

**Commit**: 21fa7a8

**Completed**:

- Implemented temporal operators with factory pattern:
  - createDaysSinceOperator(): Calculates days since event occurred
  - ITemporalService interface for abstraction (ready for real implementation)
  - Type validation with graceful null handling for invalid inputs
  - Floor rounding for fractional day calculations
- Created MockTemporalService for testing:
  - Configurable current world time for test scenarios
  - Event timestamp management (addEvent, clear)
  - Simple day calculation with millisecond precision
- Implemented ExpressionValidator class for validation:
  - Recursive descent algorithm validates expression structure
  - Checks operators against standard JSONLogic set (40+ operators)
  - Integrates with OperatorRegistry for custom operator validation
  - Error deduplication using Set for clean reporting
  - Validates deeply nested expressions and array/object literals
- Comprehensive test coverage:
  - temporal.operators.test.ts: 12 tests (all edge cases and type guards)
  - expression.validator.test.ts: 27 tests (validation scenarios)
  - Total: 39 new tests, all passing

**Test Results**: All 690 tests passing (39 new)
**Type-check**: ✅ Pass
**Lint**: ✅ Pass (0 errors, 82 warnings in test files - acceptable)

**Architecture Decisions**:

- Factory pattern consistent with spatial operators (Stage 2)
- Interface-based ITemporalService prepares for real temporal service implementation
- Validator uses Set for O(1) standard operator lookup (performance optimization)
- Error deduplication prevents redundant error messages
- Recursive validation handles arbitrarily nested expressions
- Graceful null returns instead of throwing errors (fail-safe pattern)

**Next Stage**: Stage 5 - Expression Caching & Performance Optimization

### Stage 4: Sandbox Execution & Security ✅ COMPLETE

**Commit**: e4eeeb7

**Completed**:

- Created SandboxExecutor class in packages/api/src/rules/sandbox/ for safe expression execution
- Implemented comprehensive security controls:
  - Code injection prevention via context sanitization (filters **proto**, eval, Function, global, process, etc.)
  - Prototype pollution protection (blocks dangerous property access at all levels)
  - Recursive sanitization of nested objects while preserving arrays
  - Security event logging for monitoring dangerous property attempts
- Implemented resource protection mechanisms:
  - Recursion depth limits (default: 50, configurable via maxDepth)
  - Iteration count limits (default: 10,000, configurable via maxIterations)
  - Execution timeout (default: 5000ms, configurable, can be disabled with 0)
  - Pre-execution traversal for fail-fast limit checking
- Created SandboxOptions interface with input validation:
  - Validates all options (rejects negative values)
  - Provides sensible defaults for all limits
  - Allows customization per use case (untrusted input, batch processing, etc.)
- Implemented comprehensive error handling:
  - Type-safe EvaluationResult with success/error status
  - Clear error messages with context (e.g., "Maximum recursion depth exceeded: 51 > 50")
  - Safe error logging without exposing sensitive data
  - Graceful handling of null/undefined inputs
- Comprehensive test coverage: 29 tests passing
  - Basic execution tests (simple, with context, nested expressions)
  - Recursion depth limit tests (within limit, exceeding, custom limits)
  - Iteration count limit tests (within limit, exceeding, custom limits)
  - Timeout tests (fast expressions, long-running expressions)
  - Code injection prevention tests (eval, Function, global, **proto**, safe access)
  - Error handling tests (null/undefined inputs, validation failures)
  - Options validation tests (defaults, partials, negative rejection)
  - Resource cleanup tests (timeout cleanup, memory leak prevention)
- Created comprehensive SECURITY.md documentation (375 lines):
  - Detailed threat models with real attack examples
  - Usage guidelines for different trust levels (untrusted input, admin tools, batch processing)
  - Recommended settings table for various use cases
  - Known limitations with mitigation strategies
  - Testing and incident response procedures
  - References to OWASP and security best practices
- Architecture ready for integration:
  - Follows NestJS patterns with dependency injection
  - Integrates with existing Rules Engine types (Expression, EvaluationContext, EvaluationResult)
  - Defense-in-depth approach with multiple security layers
  - Stateless execution model (state reset on each execute() call)

**Test Results**: All 719 tests passing (29 new)
**Type-check**: ✅ Pass
**Lint**: ✅ Pass (0 errors, 82 pre-existing warnings in other test files)

**Code Review**: Approved with no blocking issues by Code Reviewer subagent

- Strong security awareness with defense-in-depth approach
- Comprehensive testing covering all security scenarios
- Exceptional documentation (SECURITY.md)
- Clean, maintainable code with proper error handling
- Full TypeScript type safety with generics
- Ready for production use

**Architecture Decisions**:

- Multi-layered security (sanitization + limits + timeout) for defense-in-depth
- Pre-execution traversal for fail-fast resource limit checking
- Context sanitization filters dangerous properties recursively
- Separate SandboxExecutor class keeps concerns separated (validation vs execution vs security)
- Timeout checked during traversal (trade-off for simpler implementation)
- Iteration counting includes all structural elements (not just data) to prevent complex expression trees
- Security event logging enables monitoring for attack attempts
- Configurable limits allow different settings for different trust levels

**Security Features**:

1. **Code Injection Prevention**:
   - Filters **proto**, constructor, prototype (prototype pollution)
   - Filters eval, Function (code execution)
   - Filters global, process, require, module, exports (Node.js internals)
   - Filters **dirname, **filename (filesystem access)
   - Recursive sanitization of nested objects

2. **Resource Protection**:
   - Recursion depth limits prevent stack overflow
   - Iteration count limits prevent memory exhaustion
   - Timeout limits prevent event loop blocking
   - All limits checked before execution (fail-fast)

3. **Defense in Depth**:
   - Multiple security layers working together
   - Security event logging for monitoring
   - Graceful degradation on errors
   - Safe defaults with customization options

**Next Stage**: Stage 5 - Expression Caching & Performance Optimization

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
