# Campaign Management Tool - Epic

## Overview

Build a full-stack campaign management tool for tabletop RPGs that unifies map, flowchart, and timeline views around shared domain objects (locations, encounters, events, characters). The system supports temporal versioning (history), branching (what-if scenarios), and conditional availability via a rules engine.

## Tech Stack

- **Backend**: NestJS (GraphQL API), Node workers (rules engine, scheduler)
- **Frontend**: React + TypeScript + Vite
- **Database**: PostgreSQL + PostGIS, Redis
- **Storage**: S3-compatible (MinIO)
- **Deployment**: Docker Compose

## Architecture

Gateway API → Rules Engine + Scheduler → PostgreSQL/PostGIS + Redis + MinIO ← React Frontend

## Epic Status

- **Total Tickets**: 37
- **Completed**: 30
- **In Progress**: 0
- **Not Started**: 7

## Tickets by Status

### Infrastructure & Setup (Milestone 1: Weeks 1-2)

- [x] [TICKET-001](TICKET-001.md) - Project Scaffolding & Repository Setup
- [x] [TICKET-002](TICKET-002.md) - Docker Compose Infrastructure
- [x] [TICKET-003](TICKET-003.md) - Database Schema Design & Prisma Setup
- [x] [TICKET-004](TICKET-004.md) - Authentication & Authorization System
- [x] [TICKET-005](TICKET-005.md) - Basic GraphQL API with NestJS ✓

### Core Data Layer (Milestone 2: Weeks 3-4)

- [x] [TICKET-006](TICKET-006.md) - Entity CRUD Operations ✓
- [x] [TICKET-007](TICKET-007.md) - Versioning System Implementation ✓
- [x] [TICKET-008](TICKET-008.md) - PostGIS Spatial Data Integration ✓
- [x] [TICKET-009](TICKET-009.md) - Party & Kingdom Management ✓
- [x] [TICKET-010](TICKET-010.md) - World Time System ✓

### Rules Engine (Milestone 3: Weeks 5-6)

- [x] [TICKET-011](TICKET-011.md) - JSONLogic Expression Parser ✓
- [x] [TICKET-012](TICKET-012.md) - Condition System Implementation ✓
- [x] [TICKET-013](TICKET-013.md) - State Variable System ✓
- [x] [TICKET-014](TICKET-014.md) - Dependency Graph Builder ✓
- [x] [TICKET-015](TICKET-015.md) - Rules Engine Service Worker ✓
- [x] [TICKET-016](TICKET-016.md) - Effect System Implementation

### Frontend Core (Milestone 2-3: Weeks 3-6)

- [x] [TICKET-017](TICKET-017.md) - Frontend Project Setup (React + Vite) ✓
- [x] [TICKET-018](TICKET-018.md) - State Management & GraphQL Client ✓
- [x] [TICKET-019](TICKET-019.md) - Map View with MapLibre ✓
- [x] [TICKET-020](TICKET-020.md) - Map Editing Tools (Draw/Edit Geometry) ✓

### Advanced Features (Milestone 4: Weeks 7-8)

- [x] [TICKET-021](TICKET-021.md) - Flow View with React Flow ✓
- [x] [TICKET-022](TICKET-022.md) - Timeline View Implementation ✓
- [x] [TICKET-023](TICKET-023.md) - Entity Inspector Component ✓
- [x] [TICKET-024](TICKET-024.md) - Cross-View Synchronization ✓
- [x] [TICKET-025](TICKET-025.md) - Event & Encounter Resolution System ✓
- [x] [TICKET-026](TICKET-026.md) - Scheduler Service Worker ✓
- [x] [TICKET-036](TICKET-036.md) - Settlement & Structure Hierarchical UI ✓
- [x] [TICKET-037](TICKET-037.md) - Settlement & Structure Rules Integration ✓

### Branching & Advanced Systems (Milestone 5: Weeks 9-10)

- [x] [TICKET-027](TICKET-027.md) - Branching System (Fork & View) ✓
- [x] [TICKET-028](TICKET-028.md) - Branch Merge & Conflict Resolution ✓
- [ ] [TICKET-029](TICKET-029.md) - Real-time Updates via WebSocket/Redis

### UX & Polish (Milestone 6: Weeks 11-12)

- [ ] [TICKET-030](TICKET-030.md) - Visual Rule Builder UI
- [ ] [TICKET-031](TICKET-031.md) - Version History & Diff Viewer
- [ ] [TICKET-032](TICKET-032.md) - Audit System
- [ ] [TICKET-033](TICKET-033.md) - Caching Layer with Redis
- [ ] [TICKET-034](TICKET-034.md) - Comprehensive Test Suite
- [ ] [TICKET-035](TICKET-035.md) - Demo Seed Data & Documentation

## Dependency Graph

```mermaid
graph TD
    %% Foundation
    T001[TICKET-001: Scaffolding] --> T002[TICKET-002: Docker]
    T001 --> T017[TICKET-017: Frontend Setup]
    T002 --> T003[TICKET-003: Database Schema]
    T002 --> T004[TICKET-004: Auth]
    T003 --> T005[TICKET-005: GraphQL API]
    T004 --> T005

    %% Core Data Layer
    T005 --> T006[TICKET-006: Entity CRUD]
    T003 --> T006
    T006 --> T007[TICKET-007: Versioning]
    T003 --> T008[TICKET-008: PostGIS]
    T006 --> T009[TICKET-009: Party/Kingdom]
    T006 --> T010[TICKET-010: World Time]

    %% Rules Engine Path
    T007 --> T011[TICKET-011: JSONLogic Parser]
    T011 --> T012[TICKET-012: Conditions]
    T006 --> T013[TICKET-013: State Variables]
    T012 --> T014[TICKET-014: Dependency Graph]
    T013 --> T014
    T014 --> T015[TICKET-015: Rules Engine Worker]
    T012 --> T016[TICKET-016: Effects]
    T015 --> T016

    %% Frontend Core Path
    T017 --> T018[TICKET-018: State Management]
    T005 --> T018
    T018 --> T019[TICKET-019: Map View]
    T008 --> T019
    T019 --> T020[TICKET-020: Map Editing]

    %% Advanced Features
    T018 --> T021[TICKET-021: Flow View]
    T014 --> T021
    T018 --> T022[TICKET-022: Timeline View]
    T007 --> T022
    T018 --> T023[TICKET-023: Entity Inspector]
    T006 --> T023
    T019 --> T024[TICKET-024: Cross-View Sync]
    T021 --> T024
    T022 --> T024
    T010 --> T025[TICKET-025: Event Resolution]
    T016 --> T025
    T023 --> T025
    T010 --> T026[TICKET-026: Scheduler Worker]
    T025 --> T026
    T023 --> T036[TICKET-036: Settlement/Structure UI]
    T009 --> T036
    T018 --> T036
    T011 --> T037[TICKET-037: Settlement/Structure Rules]
    T013 --> T037
    T014 --> T037
    T009 --> T037

    %% Branching System
    T007 --> T027[TICKET-027: Branching Fork/View]
    T027 --> T028[TICKET-028: Branch Merge]

    %% Real-time
    T002 --> T029[TICKET-029: Real-time Updates]
    T015 --> T029
    T026 --> T029

    %% UX & Polish
    T012 --> T030[TICKET-030: Visual Rule Builder]
    T023 --> T030
    T007 --> T031[TICKET-031: Version Diff]
    T023 --> T031
    T006 --> T032[TICKET-032: Audit System]
    T002 --> T033[TICKET-033: Redis Caching]
    T015 --> T033
    T001 --> T034[TICKET-034: Test Suite]
    T006 --> T034
    T034 --> T035[TICKET-035: Demo & Docs]

    %% Styling
    classDef foundation fill:#e1f5ff
    classDef dataLayer fill:#fff4e1
    classDef rulesEngine fill:#ffe1f5
    classDef frontend fill:#e1ffe1
    classDef advanced fill:#f5e1ff
    classDef polish fill:#ffffcc

    class T001,T002,T003,T004,T005 foundation
    class T006,T007,T008,T009,T010 dataLayer
    class T011,T012,T013,T014,T015,T016 rulesEngine
    class T017,T018,T019,T020 frontend
    class T021,T022,T023,T024,T025,T026,T027,T028,T029,T036,T037 advanced
    class T030,T031,T032,T033,T034,T035 polish
```

## Parallel Work Streams

### Stream 1: Infrastructure (Weeks 1-2)

Can be done in parallel after T001:

- T002 (Docker)
- T017 (Frontend Setup)

### Stream 2: Core Backend (Weeks 2-4)

After T003, T004, T005 complete:

- T006 → T007 (sequential)
- T008 (parallel with T006/T007)
- T009, T010 (parallel after T006)

### Stream 3: Rules Engine (Weeks 5-6)

After T007, T006 complete:

- T011 → T012 (sequential)
- T013 (parallel with T011/T012)
- Then T014 → T015 → T016 (sequential)
- T037 (after T011, T013, T014, T009 complete)

### Stream 4: Frontend Views (Weeks 3-8)

After T017, T018 complete:

- T019 → T020 (sequential)
- T021 (parallel with T019/T020)
- T022 (parallel with T019/T020/T021)
- T023 (parallel with T019/T020/T021/T022)
- T036 (after T023, T009, T018 complete)

### Stream 5: Advanced Features (Weeks 7-9)

- T024 (after T019, T021, T022)
- T025 → T026 (sequential, after T010, T016)
- T027 → T028 (sequential, after T007)

### Stream 6: Real-time & Polish (Weeks 9-12)

- T029 (after T015, T026)
- T030, T031, T032, T033 (can be parallel)
- T034 → T035 (sequential, at the end)

## Critical Path

T001 → T002 → T003 → T005 → T006 → T007 → T011 → T012 → T014 → T015 → T025 → T026 → T029 → T034 → T035

## Notes

- Tickets are numbered based on logical implementation order
- Some tickets can be worked on in parallel (see dependency graph)
- Each ticket includes acceptance criteria, technical notes, and completion tracking
- TICKET-036 and TICKET-037 are Settlement/Structure-specific enhancements
- Total estimated time: 12-13 weeks with appropriate parallelization
