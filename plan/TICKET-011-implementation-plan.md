# TICKET-011 Implementation Plan: JSONLogic Expression Parser

## Overview

Implement a safe JSONLogic-based expression parser with custom domain operators for evaluating conditional rules. This is the foundation for the entire Rules Engine subsystem.

**Location**: `packages/api/src/rules/`

**Package**: `@campaign/api`

## Stages

### Stage 1: Core JSONLogic Integration & Setup

**Goal**: Establish basic JSONLogic parsing and evaluation capability

**Tasks**:

- [x] Add `json-logic-js` dependency to @campaign/api
- [x] Create `packages/api/src/rules/` directory structure
- [x] Define TypeScript types for expressions in `types/expression.types.ts`
- [x] Create `ExpressionParserService` with basic `parse()` and `evaluate()` methods
- [x] Write unit tests for standard JSONLogic operations (and, or, ==, !=, <, >, etc.)
- [x] Verify all tests pass (31 tests)
- [x] Run type-check and lint
- [x] Commit changes (ea4f328)

**Success Criteria**:

- ✅ Can parse JSONLogic expressions into AST
- ✅ Can evaluate basic JSONLogic operations with data context
- ✅ All standard JSONLogic operators work correctly
- ✅ Type-safe expression handling

**Status**: ✅ Complete (Commit: ea4f328)

---

### Stage 2: Custom Operator Framework & Spatial Operators

**Goal**: Create extensible custom operator system with spatial query operators

**Tasks**:

- [x] Define `CustomOperator` interface/type
- [x] Create `OperatorRegistry` class for managing custom operators
- [x] Implement operator registration and injection mechanism
- [x] Create `packages/api/src/rules/operators/` directory
- [x] Implement `inside` operator (point in region spatial query)
- [x] Implement `distanceFrom` operator (distance calculation)
- [x] Create mock spatial service for testing
- [x] Write unit tests for operator registry (15 tests)
- [x] Write unit tests for spatial operators (18 tests)
- [x] Create RulesModule for dependency injection
- [x] Verify all tests pass (651 passing)
- [x] Run type-check and lint
- [x] Commit changes (9ad4ae4)

**Success Criteria**:

- ✅ Custom operators can be registered and used in expressions
- ✅ `inside` operator correctly evaluates point-in-region queries
- ✅ `distanceFrom` operator correctly calculates distances
- ✅ Operators are type-safe and well-tested

**Status**: ✅ Complete (Commit: 9ad4ae4)

---

### Stage 3: Temporal Operators & Expression Validation

**Goal**: Implement temporal operators and add expression validation

**Tasks**:

- [x] Implement `daysSince` operator (temporal query)
- [x] Implement any additional temporal operators needed
- [x] Create mock temporal service for testing
- [x] Write unit tests for temporal operators
- [x] Create `ExpressionValidator` class in `validators/expression.validator.ts`
- [x] Implement schema validation (check expression structure)
- [x] Implement operator validation (verify all operators exist)
- [x] Add validation for operator arguments (type checking)
- [x] Write comprehensive validation tests
- [x] Verify all tests pass
- [x] Run type-check and lint
- [x] Commit changes

**Success Criteria**:

- ✅ Temporal operators work correctly with time-based queries
- ✅ Validator catches malformed expressions before execution
- ✅ Validator catches references to undefined operators
- ✅ Validator provides helpful error messages
- ✅ All validation rules have test coverage

**Status**: ✅ Complete (Commit: 21fa7a8)

---

### Stage 4: Sandbox Execution & Security

**Goal**: Ensure safe expression execution with resource limits and security checks

**Tasks**:

- [x] Create `SandboxExecutor` class for safe evaluation
- [x] Implement maximum recursion depth limit
- [x] Implement maximum iteration count limit
- [x] Implement execution timeout protection
- [x] Add checks to prevent code injection attacks
- [x] Prevent access to dangerous JavaScript features (eval, Function, etc.)
- [x] Write security tests (attempt code injection, infinite loops, etc.)
- [x] Write resource limit tests
- [x] Document security considerations
- [x] Verify all tests pass (29 tests, all passing)
- [x] Run type-check and lint (via TypeScript Fixer subagent)
- [x] Commit changes (e4eeeb7)

**Success Criteria**:

- ✅ Expressions execute in a sandboxed environment
- ✅ Resource limits prevent infinite loops and deep recursion
- ✅ Timeout prevents long-running expressions from blocking
- ✅ Code injection attempts are blocked
- ✅ Security tests verify protection mechanisms

**Status**: ✅ Complete (Commit: e4eeeb7)

---

### Stage 5: Expression Caching & Performance Optimization

**Goal**: Optimize expression evaluation with caching

**Tasks**:

- [ ] Create `ExpressionCache` class in `cache/expression-cache.ts`
- [ ] Implement LRU (Least Recently Used) cache for parsed expressions
- [ ] Create cache key generation from expression JSON
- [ ] Add cache invalidation mechanism
- [ ] Add cache hit/miss metrics hooks
- [ ] Configure cache size limits
- [ ] Write cache behavior tests
- [ ] Write performance tests (cache hit speedup)
- [ ] Add cache statistics/monitoring
- [ ] Verify all tests pass
- [ ] Run type-check and lint
- [ ] Commit changes

**Success Criteria**:

- Parsed expressions are cached to avoid re-parsing
- Cache correctly evicts least recently used entries
- Cache key generation is deterministic
- Cache provides measurable performance improvement
- Cache statistics available for monitoring

**Status**: Not Started

---

## Testing Strategy

- **Unit Tests**: Test each operator, validator, and cache component in isolation
- **Integration Tests**: Test ExpressionParser with all operators working together
- **Security Tests**: Attempt various injection and resource exhaustion attacks
- **Performance Tests**: Verify caching provides speedup

## Dependencies

- `json-logic-js`: Core JSONLogic library
- May need LRU cache library (e.g., `lru-cache`) or implement custom

## Notes

- Follow TDD approach: write tests before implementation
- Each stage should be committed separately with detailed commit message
- Update TICKET-011.md with implementation notes after each stage
- Use TypeScript Fixer subagent for any type/lint errors
- Use TypeScript Tester subagent for running and debugging tests
- Use Code Reviewer subagent before each commit
