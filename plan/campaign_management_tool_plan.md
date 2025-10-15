# 1) product goals (from your requirements)

- unify **map + flowchart + timeline** views around shared domain objects (locations, encounters, events, characters).
- every object can **change over time** (history) and **branch** (what-if states).
- **conditional availability** via a rules system (depends on world time, party/character level, status flags, arbitrary field values).
- map authoring (points/regions), region evolution over time, and **linking** of locations ↔ encounters/events/characters.
- full-stack TS, React frontend, Docker deploy (including DB).

# 2) high-level architecture

- **Gateway API (NestJS)** — GraphQL (or REST) for queries/mutations; authentication, RBAC, validation.
- **Rules/State Engine (Node worker)** — evaluates conditional expressions, maintains dependency graph, performs incremental recomputation; exposes a lightweight gRPC/HTTP interface + subscribes to event bus.
- **Scheduler/World Clock (Node worker)** — manages world-time progression, cron-like jobs, deferred triggers.
- **DB: Postgres + PostGIS** — relational + spatial; event-sourced + bitemporal versioning; optional Redis for cache/pubsub.
- **File/Asset storage** — S3-compatible (e.g., MinIO) for map tiles, images.
- **Frontend: React + Vite** — Map (MapLibre/Leaflet), Flow (React Flow), Timeline (Vis-Timeline or React-Flow-Timeline), schema-driven editors.
- **Real-time** — WebSocket (Socket.IO) or GraphQL Subscriptions via Redis pub/sub.

(services: `api`, `rules-engine`, `scheduler`, `frontend`, `postgres`, `redis`, `minio`)

# 3) data modeling (core concepts)

## 3.1 entities

- **World**(id, name, calendars…)
- **Campaign**(id, world_id, branch_root_id, settings)
- **Party**(id, campaign_id, average_level, vars_json)
- **Kingdom**(id, campaign_id, level, vars_json)
- **Character**(id, campaign_id, name, …)
- **Location**(id, world_id, type: point|region, geom: PostGIS, parent_location_id)
- **Encounter**(id, campaign_id, …)
- **Event**(id, campaign_id, …)
- **StateVariable**(id, scope: world|campaign|party|character|location|event|encounter, key, value JSON, derived:boolean)
- **Link**(id, from_entity, to_entity, role) — e.g., Location ↔ Encounter, Character ↔ Event
- **Condition**(id, owner_entity, field_path, expr_json) — JSON expression referencing variables.
- **Effect**(id, event_id, target_entity, patch_json, when: pre|post|onResolve)
- **Version**(id, entity_type, entity_id, branch_id, valid_from, valid_to, payload_json, created_at, created_by)
- **Branch**(id, campaign_id, parent_branch_id, name, fork_point_version_id)

Notes

- All user-editable fields live in **Version.payload_json** (schema-validated).
- **valid_from/valid_to** enable bitemporal “as-of world time” views.
- **Branches** allow “what-if” or alternate histories; a branch starts from a version snapshot.
- **Condition** binds dynamic/derived fields: “visibility”, “available_from”, “available_to”, “description”, etc.
- **Effect** lets events/encounters mutate world state or other entities when they resolve.

## 3.2 spatial model (maps/regions)

- **Location.geom**: POINT for POIs; POLYGON/MULTIPOLYGON for regions.
- Evolving borders via **Version** records of a Location; each version has its own geom (so regions can change over time/branch).
- Tile generation (optional) done offline or at save-time, or render vector GeoJSON directly on the client.

## 3.3 dependency graph

- Edges derived from:
  - Conditions referencing **StateVariables** or other entity fields.
  - Effects that patch other entities.
  - Explicit design links (e.g., “Event B requires Event A resolved”).

- Store as an adjacency table: **Dependency**(from_entity_field, to_entity_field, type: reads|writes).
- The rules engine builds an in-memory DAG per campaign/branch; detect cycles and warn.

# 4) condition & rules system

## 4.1 expression format

Use a safe, portable JSON expression (JSONLogic-style), extended with domain helpers.

Example:

```json
{
  "and": [
    { ">=": [{ "var": "party.average_level" }, 5] },
    { ">=": [{ "var": "kingdom.level" }, 3] },
    { "<": [{ "var": "world.time" }, "1032-07-01T00:00:00Z"] },
    { "==": [{ "var": "event.dead_king_resolved" }, true] }
  ]
}
```

### Supported variables

- `world.time` (ISO datetime in world calendar)
- `party.average_level`, `character.<id>.level`
- `kingdom.level`
- `flags.<key>` (arbitrary)
- `entity("<type>", "<id>").fieldPath` (cross-entity references)
- spatial helper: `inside(locationId, regionId)` (server provides boolean)
- spatial helper: `distanceFrom(targetId)` (returns distance from point or shortest distance from region border)
- time helper: `daysSince("event:<id>.resolved_at")`
- time helper: `hoursSince("event:<id>.resolved_at")`
- time helper: `monthsSince("event:<id>.resolved_at")`

### Operators

- JSONLogic boolean/compare/math/string
- domain ops: `in`, `overlaps`, `distanceMiles(a,b)`, `now()`, `coalesce`, `notEmpty`

## 4.2 evaluation model

- **Pull**: API resolves “computed view” for a context `{branch, asOfTime, partyState, flags}`.
- **Push**: when inputs change (world time tick, party level up, event resolve), the rules engine recalculates affected nodes using the dependency DAG; publishes invalidation messages via Redis.

## 4.3 safety & perf

- Evaluate in a sandbox (no `eval`).
- Cache expression AST per field.
- Memoize variable lookups.
- Topological order; if cycles, mark involved fields as **indeterminate** and surface to UI.

# 5) versioning & branching

- **Event-sourced + bitemporal**: every change is a new **Version** with `valid_from/valid_to`.

- A **Branch** records its parent and fork point; queries include `branch_id` and follow branch override semantics:
  1. exact branch version if present,
  2. else nearest ancestor branch version created before `asOfTime`.

- “Time-travel” preview: compute state “as of X” without mutating anything.

- Merge: cherry-pick or rebase branch versions back to parent with conflict resolution (3-way merge of `payload_json`).

# 6) API design (GraphQL recommended)

### core types (examples)

```graphql
type Query {
  world(id: ID!): World
  campaign(id: ID!, branch: ID, asOf: DateTime): Campaign
  searchEntities(input: SearchInput!): [EntityRef!]!
  computedEntity(ref: EntityRefInput!, ctx: ComputeContext!): ComputedEntity!
  mapLayer(campaignId: ID!, branch: ID, asOf: DateTime): GeoJSON!
}

type Mutation {
  createEntity(input: CreateEntityInput!): EntityRef!
  editEntity(input: EditEntityInput!): Version!
  addCondition(input: AddConditionInput!): Condition!
  addEffect(input: AddEffectInput!): Effect!
  resolveEvent(eventId: ID!, ctx: ResolveContext!): ResolveResult!
  advanceWorldTime(campaignId: ID!, to: DateTime!): WorldTimeResult!
  setPartyLevel(campaignId: ID!, level: Int!): PartyLevelResult!
  setKingdomLevel(campaignId: ID!, level: Int!): KingdomLevelResult!
  forkBranch(campaignId: ID!, fromBranch: ID!, name: String!): Branch!
  mergeBranch(input: MergeBranchInput!): MergeResult!
}
```

### query behavior

- All read queries accept `{branch, asOf}` to project the correct state.
- `computedEntity` returns `basePayload`, `computedFields`, `effectiveVisibility`, `availabilityWindow`, `warnings`.

### subscriptions (optional)

- `stateInvalidations(campaignId)` — list of entity ids/fields to refetch.
- `worldTimeTicks(campaignId)` — push updates when scheduler advances time.

# 7) frontend (React) implementation

## 7.1 tech & libs

- **React + TypeScript + Vite**
- State: **Zustand** (simple & fast) or Redux Toolkit
- **Map**: MapLibre GL JS or Leaflet (vector GeoJSON layers)
- **Flowchart**: React Flow (node/edge editing, mini-map, layout)
- **Timeline**: vis-timeline (react wrapper) or `react-calendar-timeline`
- **Code/JSON editors**: Monaco for advanced rule JSON; plus a **visual rule builder** (form-UI over JSONLogic)
- Styling: Tailwind + Radix UI/shadcn

## 7.2 key screens

- **Campaign Workspace** (three synchronized panes with cross-highlighting):
  1. **Map** view: add/edit POIs (points) & Regions (polygons); time scrubber; layer toggles (by type/availability).
  2. **Flow** view: dependency graph (events/encounters/locations/characters as nodes); edge types (requires, unlocks, influences).
  3. **Timeline** view: events/encounters lanes; drag to adjust planned `valid_from/valid_to`; availability overlay.

- **Entity Inspector**: right drawer with tabs:
  - Overview (description; computed visibility)
  - Links (related entities)
  - Conditions (visual builder + JSON)
  - Effects
  - Versions (history with diff & “revert to…”)

- **Rule Builder**: visual if/and/or blocks; variable picker with autocomplete; live preview “Would this be available now?”
- **Branch Manager**: create fork, compare branch vs parent, merge UI with conflict markers.
- **Character Manager**: levels, stats (extensible), links to locations/events; fields "that change over time".
- **Party Manager**: party average level, party-specific variables; ability to adjust level to see event changes.
- **Kingdom Manager**: kingdom level, kingdom-specific variables; ability to adjust level to see event changes.

## 7.3 UX details

- Context bar (top): `{campaign, branch, asOf world time, party summary}` shared across views.
- Cross-selection: click a map region → highlight the same node on Flow & its bar on Timeline.
- “Available now” filter toggle.
- Warnings panel (cycle detected, dangling references, rule parse errors).

# 8) map creation & editing

- Draw tools for POINT/POLYGON (react-map-gl-draw or Leaflet.draw).
- Region evolution: open **Versions** tab on a Location (Region), clone current geometry, set new `valid_from`.
- Pin styling by availability (computed).
- Snapshots: export/import GeoJSON.

# 9) characters, locations, events, encounters (time-aware & branching)

- Each entity’s **payload_json** includes canonical fields (name, description, tags, stats…) and optional computed fields that can be bound to **Condition** rows. Example:

```json
{
  "description": "Base text shown if no rule applies",
  "_computed": {
    "description": {
      "if": [
        {
          "and": [
            { ">=": [{ "var": "party.average_level" }, 7] },
            { "==": [{ "var": "flags.city_in_revolt" }, true] }
          ]
        },
        "The city seethes; guards triple patrols.",
        {
          "if": [
            { "<": [{ "var": "party.average_level" }, 3] },
            "Everything feels too quiet.",
            null
          ]
        }
      ]
    },
    "visible": {
      "and": [
        { ">=": [{ "var": "party.average_level" }, 5] },
        { ">=": [{ "var": "kingdom.level" }, 2] },
        { "<": [{ "var": "world.time" }, "1032-07-01"] }
      ]
    }
  }
}
```

- UI surfaces both **base** and **computed** values and shows why a value is in effect (“explain” link renders the rule evaluation trace).

# 10) scheduler & world time

- World-time lives per campaign; advanced via manual jumps only (no auto-advance).
- Scheduler runs due **Effects** (e.g., "if not resolved by X, mark event expired") and posts invalidations.
- "Simulate to date" runs the rules engine in fast-forward without persisting changes (preview).

# 11) backend implementation details

- **Framework**: NestJS, GraphQL (Apollo) or REST (tRPC acceptable).
- **ORM**: Prisma with `postgresqlExtensions = [postgis]`.
- **Schema migration**: Prisma Migrate or Atlas.
- **Geo**: store geom as `GEOMETRY` (WGS84). Expose GeoJSON from API.
- **Caching**: Redis for pub/sub + caching computed availability sets per `{branch, asOf, partyHash, flagHash}` with TTL.
- **Auth**: JWT (Auth0/Cognito optional). Roles: Owner, GM, Player (read-only subset), Viewer.
- **Rate limiting & input validation**: Zod DTOs on API boundary.
- **Auditing**: every mutation writes an Audit row with diff and actor.

# 12) deployment (Docker)

## docker-compose.yml (outline)

- `postgres` (with PostGIS)
- `redis`
- `minio` (or connect to S3)
- `api` (NestJS)
- `rules-engine` (Node worker)
- `scheduler` (Node worker)
- `frontend` (Nginx serving Vite build)

### env highlights

```
DATABASE_URL=postgres://user:pass@postgres:5432/rpg
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
JWT_SECRET=...
```

### migrations & seed

- `api` container runs migrations on startup.
- Seed script creates a sample world, a map, a few entities with conditions/effects, and a demo branch.

# 13) testing strategy

- **Unit**: rules parser/evaluator (golden tests), DAG builder (cycle detection), branch resolution, temporal queries.
- **Integration**: end-to-end “create → version → fork → compute → merge” flows; spatial queries (inside/overlaps).
- **UI**: Cypress for core authoring flows; visual snapshot tests for map/flow/timeline sync.
- **Load**: recomputation benchmarks with 10k entities, 50k dependencies; ensure <50ms incremental invalidation for typical edits.

# 14) performance & scalability

- Lazy load by viewport on map; server returns features within bbox and available filters.
- Pre-index dependency edges (`owner_entity, field_path`) and version ranges (btree on `valid_from/valid_to`).
- Batch compute results for timeline spans.
- Background precomputation of “availability sets” per day/week to accelerate scrubbing.

# 15) extensibility & integrations

- **Importers**: CSV/JSON for locations, NPCs; GeoJSON for maps.
- **Plugins**: allow registering new StateVariable providers (e.g., weather, faction reputation).

# 16) risks & mitigations

- **Expression complexity** → provide a visual builder + lints + “explain” traces; cap recursion; cycle detection.
- **Branch merges** → 3-way merge UI with conflict markers; narrow payloads by schema to reduce conflicts.
- **Spatial accuracy** → snap/validate polygons; topology checks; CRS consistency.
- **Performance at scale** → cache, indexes, incremental recompute, server-side pagination.

# 17) milestone plan (8–12 weeks)

**M1 (week 1–2)**: scaffold repos, DB with PostGIS, auth, basic GraphQL, entity CRUD, Version table.
**M2 (week 3–4)**: Map view with GeoJSON editing; Versioned locations; Party & world-time basics.
**M3 (week 5–6)**: JSONLogic rules; dependency graph; computed availability; Flow (React Flow).
**M4 (week 7–8)**: Timeline with availability overlays; events/encounters resolve + effects; scheduler.
**M5 (week 9–10)**: Branching (fork, view as-of, merge minimal); audit; caching; real-time invalidations.
**M6 (week 11–12)**: UX polishing; rule builder; diffing; test coverage; Docker compose; seed demo.

---

## quick developer notes (copy/paste helpers)

### example: condition variable resolution contract

```ts
// rules-engine
export interface ComputeContext {
  branchId: string;
  asOf: string; // ISO
  campaignId: string;
  partyId?: string;
  flags?: Record<string, unknown>;
}

export type VarResolver = (path: string, ctx: ComputeContext) => Promise<unknown>;
// examples: "party.average_level", "entity('event','e123').status"
```

### example: dependency edge extraction

- Parse each `Condition.expr_json` AST; collect every `var`/`entity()` reference → record `reads`.
- Parse each `Effect.patch_json` target fields → record `writes`.
- Build DAG per campaign/branch.

### example: availability check API

```
GET /campaigns/:id/available?asOf=1032-06-01T00:00:00Z&branch=b1
→ { events: [...ids], encounters: [...], locations: [...] }
```

---

if you want, I can also generate:

- a Prisma schema starter (with PostGIS types),
- a NestJS module layout,
- and a React page skeleton (map + flow + timeline panes)
  so your team can bootstrap the repo immediately.
