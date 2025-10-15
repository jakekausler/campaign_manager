# TICKET-014: Dependency Graph Builder

## Status
- [ ] Completed
- **Commits**:

## Description
Build a dependency graph system that tracks relationships between conditions, variables, effects, and entities to enable incremental recomputation and cycle detection.

## Scope of Work
1. Create dependency graph data structure
2. Extract dependencies from conditions (reads)
3. Extract dependencies from effects (writes)
4. Build in-memory DAG per campaign/branch
5. Implement topological sort
6. Add cycle detection
7. Create invalidation propagation system

## Acceptance Criteria
- [ ] Dependency graph builds from conditions/effects
- [ ] Can detect cycles in dependencies
- [ ] Topological sort provides evaluation order
- [ ] Changes propagate to dependent nodes
- [ ] Graph updates incrementally on changes

## Dependencies
- Requires: TICKET-012, TICKET-013

## Estimated Effort
4-5 days
