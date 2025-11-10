# GraphQL Queries Reference

This document provides a comprehensive reference for all GraphQL queries available in the Campaign Manager API, organized by entity type with practical examples.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Campaign Management](#campaign-management)
- [Geographic Entities](#geographic-entities)
- [Gameplay Entities](#gameplay-entities)
- [Advanced Features](#advanced-features)
- [Utility Queries](#utility-queries)
- [Query Patterns](#query-patterns)
- [Best Practices](#best-practices)

---

## Overview

The Campaign Manager API exposes **75+ query methods** across **23 resolvers**. Queries follow consistent patterns:

- **Single Entity Lookup**: `entity(id: ID!)`
- **List by Parent**: `entitiesByParent(parentId: ID!)`
- **List by Container**: `entitiesByCampaign(campaignId: ID!)`
- **Filtered Lists**: `listEntities(filters: {...}, limit: Int, offset: Int)`

Most queries require JWT authentication. See [Authentication](#authentication) for details.

---

## Authentication

Most queries require a valid JWT token in the `Authorization` header:

```http
POST /graphql
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Public Queries** (no authentication required):

- `health` - Health check
- `mapLayer` - Public map data

All other queries require authentication and verify user access to requested resources.

---

## Campaign Management

### World Queries

Get worlds and their metadata.

#### Get Single World

```graphql
query GetWorld {
  world(id: "world-123") {
    id
    name
    description
    createdAt
    updatedAt
    version
  }
}
```

#### Get All Worlds

```graphql
query GetAllWorlds {
  worlds {
    id
    name
    description
    # Related entities (lazy-loaded)
    campaigns {
      id
      name
    }
    locations {
      id
      name
      locationType
    }
  }
}
```

**Response Example:**

```json
{
  "data": {
    "worlds": [
      {
        "id": "world-1",
        "name": "Golarion",
        "description": "Pathfinder campaign setting",
        "campaigns": [{ "id": "campaign-1", "name": "Rise of the Runelords" }],
        "locations": [{ "id": "loc-1", "name": "Varisia", "locationType": "REGION" }]
      }
    ]
  }
}
```

---

### Campaign Queries

Get campaigns within worlds.

#### Get Single Campaign

```graphql
query GetCampaign {
  campaign(id: "campaign-123") {
    id
    name
    description
    startDate
    currentDate
    isActive
    world {
      id
      name
    }
    version
  }
}
```

#### Get All Campaigns (User's Campaigns)

```graphql
query MyCampaigns {
  campaigns {
    id
    name
    isActive
    world {
      id
      name
    }
  }
}
```

#### Get Campaigns by World

```graphql
query CampaignsByWorld($worldId: ID!) {
  campaignsByWorld(worldId: $worldId) {
    id
    name
    description
    currentDate
    parties {
      id
      name
    }
  }
}
```

**Variables:**

```json
{
  "worldId": "world-1"
}
```

---

## Geographic Entities

### Location Queries

Hierarchical geographic entities (continents, regions, cities, etc.).

#### Get Single Location

```graphql
query GetLocation($id: ID!) {
  location(id: $id) {
    id
    name
    locationType
    description
    # GeoJSON geometry (lazy-loaded via DataLoader)
    geojson
    # Parent-child hierarchy
    parent {
      id
      name
      locationType
    }
    children {
      id
      name
      locationType
    }
    # Related entities
    world {
      id
      name
    }
    metadata
    version
  }
}
```

**Variables:**

```json
{
  "id": "loc-sandpoint"
}
```

**Response Example:**

```json
{
  "data": {
    "location": {
      "id": "loc-sandpoint",
      "name": "Sandpoint",
      "locationType": "TOWN",
      "description": "A coastal town in Varisia",
      "geojson": {
        "type": "Point",
        "coordinates": [-123.356, 48.407]
      },
      "parent": {
        "id": "loc-varisia",
        "name": "Varisia",
        "locationType": "REGION"
      },
      "children": [],
      "world": {
        "id": "world-1",
        "name": "Golarion"
      },
      "metadata": {
        "population": 1200,
        "founded": "4667 AR"
      },
      "version": 1
    }
  }
}
```

#### Get Locations by World

```graphql
query LocationsByWorld($worldId: ID!) {
  locationsByWorld(worldId: $worldId) {
    id
    name
    locationType
    geojson
  }
}
```

#### Get Locations by Parent

Get child locations of a parent (e.g., cities within a region):

```graphql
query LocationsByParent($parentLocationId: ID!) {
  locationsByParent(parentLocationId: $parentLocationId) {
    id
    name
    locationType
    description
    geojson
  }
}
```

**Variables:**

```json
{
  "parentLocationId": "loc-varisia"
}
```

---

### Kingdom Queries

Political regions with evolving borders.

#### Get Single Kingdom

```graphql
query GetKingdom($id: ID!) {
  kingdom(id: $id) {
    id
    name
    description
    location {
      id
      name
      geojson
    }
    campaign {
      id
      name
    }
    createdAt
    version
  }
}
```

#### Get Kingdoms by Campaign

```graphql
query KingdomsByCampaign($campaignId: ID!) {
  kingdomsByCampaign(campaignId: $campaignId) {
    id
    name
    description
    location {
      id
      name
    }
  }
}
```

#### Get Kingdom Variables

```graphql
query KingdomVariables($kingdomId: ID!) {
  kingdomVariables(kingdomId: $kingdomId) {
    key
    value
    type
  }

  # Get variable schemas
  kingdomVariableSchemas(kingdomId: $kingdomId) {
    key
    type
    description
    defaultValue
  }
}
```

---

### Settlement Queries

Towns, cities, and villages with typed variables.

#### Get Single Settlement

```graphql
query GetSettlement($id: ID!) {
  settlement(id: $id) {
    id
    name
    settlementType
    level
    xp
    variables
    location {
      id
      name
      geojson
    }
    kingdom {
      id
      name
    }
    structures {
      id
      name
      structureType
    }
    computedFields
    version
  }
}
```

#### Get Settlements by Kingdom

```graphql
query SettlementsByKingdom($kingdomId: ID!) {
  settlementsByKingdom(kingdomId: $kingdomId) {
    id
    name
    settlementType
    level
    location {
      id
      name
    }
  }
}
```

#### Get Settlement Variables

```graphql
query SettlementVariables($settlementId: ID!) {
  # Get all variables
  settlementVariables(settlementId: $settlementId) {
    key
    value
    type
  }

  # Get specific variable
  settlementVariable(settlementId: $settlementId, key: "population") {
    key
    value
    type
  }

  # Get variable schemas
  settlementVariableSchemas(settlementId: $settlementId) {
    key
    type
    description
    defaultValue
    computed
  }
}
```

**Variables:**

```json
{
  "settlementId": "settlement-sandpoint"
}
```

**Response Example:**

```json
{
  "data": {
    "settlementVariables": [
      { "key": "population", "value": 1200, "type": "number" },
      { "key": "morale", "value": 75, "type": "number" },
      { "key": "defenses", "value": 50, "type": "number" }
    ],
    "settlementVariable": {
      "key": "population",
      "value": 1200,
      "type": "number"
    },
    "settlementVariableSchemas": [
      {
        "key": "population",
        "type": "number",
        "description": "Settlement population",
        "defaultValue": 0,
        "computed": false
      }
    ]
  }
}
```

#### Get Settlement State at Specific Time (Time-Travel)

```graphql
query SettlementAsOf($id: ID!, $worldTime: Date!, $branchId: ID) {
  settlementAsOf(id: $id, worldTime: $worldTime, branchId: $branchId) {
    id
    name
    level
    xp
    variables
    # Historical state at specified time
  }
}
```

**Variables:**

```json
{
  "id": "settlement-sandpoint",
  "worldTime": "4707-09-21T00:00:00Z",
  "branchId": "main"
}
```

---

### Structure Queries

Buildings and constructions within settlements.

#### Get Single Structure

```graphql
query GetStructure($id: ID!) {
  structure(id: $id) {
    id
    name
    structureType
    level
    xp
    variables
    settlement {
      id
      name
    }
    computedFields
    version
  }
}
```

#### Get Structures by Settlement

```graphql
query StructuresBySettlement($settlementId: ID!) {
  structuresBySettlement(settlementId: $settlementId) {
    id
    name
    structureType
    level
    variables
  }
}
```

#### Get Structure Variables

```graphql
query StructureVariables($structureId: ID!) {
  structureVariables(structureId: $structureId) {
    key
    value
    type
  }

  structureVariable(structureId: $structureId, key: "capacity") {
    key
    value
    type
  }

  structureVariableSchemas(structureId: $structureId) {
    key
    type
    description
    defaultValue
  }
}
```

#### Get Structure State at Specific Time (Time-Travel)

```graphql
query StructureAsOf($id: ID!, $worldTime: Date!, $branchId: ID) {
  structureAsOf(id: $id, worldTime: $worldTime, branchId: $branchId) {
    id
    name
    level
    variables
  }
}
```

---

## Gameplay Entities

### Event Queries

Time-based events with conditions and effects.

#### Get Single Event

```graphql
query GetEvent($id: ID!) {
  event(id: $id) {
    id
    name
    description
    eventType
    scheduledDate
    resolvedDate
    isResolved
    outcome
    location {
      id
      name
    }
    campaign {
      id
      name
    }
    # Conditions (JSONLogic)
    conditions {
      id
      field
      operator
      value
      logic
    }
    # Effects (JSON Patch)
    effects {
      id
      targetType
      targetId
      jsonPatch
      description
    }
    metadata
    version
  }
}
```

#### Get Events by Campaign

```graphql
query EventsByCampaign($campaignId: ID!) {
  eventsByCampaign(campaignId: $campaignId) {
    id
    name
    eventType
    scheduledDate
    isResolved
    location {
      id
      name
    }
  }
}
```

#### Get Events by Location

```graphql
query EventsByLocation($locationId: ID!) {
  eventsByLocation(locationId: $locationId) {
    id
    name
    eventType
    scheduledDate
    isResolved
  }
}
```

#### Get Overdue Events

```graphql
query GetOverdueEvents($campaignId: ID!, $gracePeriod: Int) {
  getOverdueEvents(campaignId: $campaignId, gracePeriod: $gracePeriod) {
    id
    name
    scheduledDate
    # Events where scheduledDate < currentTime - gracePeriod
  }
}
```

**Variables:**

```json
{
  "campaignId": "campaign-1",
  "gracePeriod": 3600
}
```

---

### Encounter Queries

Combat/interaction scenarios with dependencies.

#### Get Single Encounter

```graphql
query GetEncounter($id: ID!) {
  encounter(id: $id) {
    id
    name
    description
    encounterType
    difficulty
    isResolved
    outcome
    location {
      id
      name
    }
    campaign {
      id
      name
    }
    party {
      id
      name
    }
    metadata
    version
  }
}
```

#### Get Encounters by Campaign

```graphql
query EncountersByCampaign($campaignId: ID!) {
  encountersByCampaign(campaignId: $campaignId) {
    id
    name
    encounterType
    difficulty
    isResolved
    location {
      id
      name
    }
  }
}
```

#### Get Encounters by Location

```graphql
query EncountersByLocation($locationId: ID!) {
  encountersByLocation(locationId: $locationId) {
    id
    name
    encounterType
    difficulty
    isResolved
  }
}
```

---

### Party Queries

Player groups with shared progression.

#### Get Single Party

```graphql
query GetParty($id: ID!) {
  party(id: $id) {
    id
    name
    description
    level
    campaign {
      id
      name
    }
    characters {
      id
      name
      characterClass
      level
    }
    version
  }
}
```

#### Get Parties by Campaign

```graphql
query PartiesByCampaign($campaignId: ID!) {
  partiesByCampaign(campaignId: $campaignId) {
    id
    name
    level
    characters {
      id
      name
    }
  }
}
```

#### Get Party Variables

```graphql
query PartyVariables($partyId: ID!) {
  partyVariables(partyId: $partyId) {
    key
    value
    type
  }

  partyVariableSchemas(partyId: $partyId) {
    key
    type
    description
    defaultValue
  }
}
```

---

### Character Queries

Player characters and NPCs.

#### Get Single Character

```graphql
query GetCharacter($id: ID!) {
  character(id: $id) {
    id
    name
    characterClass
    level
    isNPC
    campaign {
      id
      name
    }
    party {
      id
      name
    }
    metadata
    version
  }
}
```

#### Get Characters by Campaign

```graphql
query CharactersByCampaign($campaignId: ID!) {
  charactersByCampaign(campaignId: $campaignId) {
    id
    name
    characterClass
    level
    isNPC
    party {
      id
      name
    }
  }
}
```

#### Get Characters by Party

```graphql
query CharactersByParty($partyId: ID!) {
  charactersByParty(partyId: $partyId) {
    id
    name
    characterClass
    level
    isNPC
  }
}
```

---

## Advanced Features

### Branch Queries (Alternate Timelines)

Git-like branching for "what-if" scenarios.

#### Get Single Branch

```graphql
query GetBranch($id: ID!) {
  branch(id: $id) {
    id
    name
    description
    branchPoint
    customVariables
    campaign {
      id
      name
    }
    parentBranch {
      id
      name
    }
    childBranches {
      id
      name
    }
    createdAt
    version
  }
}
```

#### Get All Branches (Flat List)

```graphql
query GetBranches($campaignId: ID!) {
  branches(campaignId: $campaignId) {
    id
    name
    branchPoint
    parentBranch {
      id
      name
    }
  }
}
```

#### Get Branch Hierarchy (Tree Structure)

```graphql
query GetBranchHierarchy($campaignId: ID!) {
  branchHierarchy(campaignId: $campaignId) {
    branch {
      id
      name
      branchPoint
    }
    children {
      branch {
        id
        name
      }
      children {
        # Recursive tree structure
      }
    }
  }
}
```

**Response Example:**

```json
{
  "data": {
    "branchHierarchy": [
      {
        "branch": {
          "id": "main",
          "name": "Main Timeline",
          "branchPoint": null
        },
        "children": [
          {
            "branch": {
              "id": "branch-peaceful",
              "name": "Peaceful Festival",
              "branchPoint": "4707-09-21T20:00:00Z"
            },
            "children": []
          }
        ]
      }
    ]
  }
}
```

---

### Merge Queries (3-Way Merge)

Preview and track branch merges.

#### Preview Merge

```graphql
query PreviewMerge($sourceBranchId: ID!, $targetBranchId: ID!) {
  previewMerge(sourceBranchId: $sourceBranchId, targetBranchId: $targetBranchId) {
    conflicts {
      path
      baseValue
      sourceValue
      targetValue
      conflictType
    }
    autoResolved {
      path
      resolvedValue
    }
    summary {
      totalChanges
      conflictCount
      autoResolvedCount
    }
  }
}
```

**Variables:**

```json
{
  "sourceBranchId": "branch-peaceful",
  "targetBranchId": "main"
}
```

#### Get Merge History

```graphql
query GetMergeHistory($branchId: ID!, $limit: Int, $offset: Int) {
  getMergeHistory(branchId: $branchId, limit: $limit, offset: $offset) {
    id
    sourceBranch {
      id
      name
    }
    targetBranch {
      id
      name
    }
    mergedAt
    mergedBy {
      id
      email
    }
    conflictCount
    resolution
  }
}
```

---

### State Variable Queries

Dynamic typed variables with schema validation.

#### Get Single State Variable

```graphql
query GetStateVariable($id: ID!) {
  getStateVariable(id: $id) {
    id
    key
    scope
    value
    type
    schema
    computed
    version
  }
}
```

#### List State Variables

```graphql
query ListStateVariables($scope: String, $limit: Int, $offset: Int, $sort: String) {
  listStateVariables(scope: $scope, limit: $limit, offset: $offset, sort: $sort) {
    id
    key
    scope
    value
    type
  }
}
```

#### Get Variables for Scope

```graphql
query GetVariablesForScope($scope: String!, $key: String) {
  getVariablesForScope(scope: $scope, key: $key) {
    id
    key
    value
    type
  }
}
```

**Variables:**

```json
{
  "scope": "settlement:settlement-sandpoint",
  "key": "population"
}
```

#### Evaluate State Variable

```graphql
query EvaluateStateVariable($id: ID!, $context: JSON) {
  evaluateStateVariable(id: $id, context: $context) {
    value
    type
    computed
    dependencies
  }
}
```

---

### Field Condition Queries (JSONLogic)

Conditional logic for dynamic rules.

#### Get Single Field Condition

```graphql
query GetFieldCondition($id: ID!) {
  getFieldCondition(id: $id) {
    id
    entityId
    entityType
    field
    operator
    value
    logic
    description
    createdBy {
      id
      email
    }
    version
  }
}
```

#### List Field Conditions

```graphql
query ListFieldConditions($entityId: ID, $field: String, $limit: Int, $offset: Int) {
  listFieldConditions(entityId: $entityId, field: $field, limit: $limit, offset: $offset) {
    id
    entityId
    field
    operator
    value
  }
}
```

#### Get Conditions for Entity

```graphql
query GetConditionsForEntity($entityId: ID!, $field: String) {
  getConditionsForEntity(entityId: $entityId, field: $field) {
    id
    field
    operator
    value
    logic
  }
}
```

#### Evaluate Field Condition

```graphql
query EvaluateFieldCondition($id: ID!, $context: JSON) {
  evaluateFieldCondition(id: $id, context: $context) {
    result
    evaluatedAt
    context
  }
}
```

**Variables:**

```json
{
  "id": "condition-123",
  "context": {
    "settlement": {
      "variables": {
        "population": 5500
      }
    }
  }
}
```

---

### Dependency Graph Queries

Track relationships between entities for impact analysis.

#### Get Complete Dependency Graph

```graphql
query GetDependencyGraph($campaignId: ID!, $branchId: ID) {
  getDependencyGraph(campaignId: $campaignId, branchId: $branchId) {
    nodes {
      id
      type
      label
    }
    edges {
      source
      target
      type
    }
    stats {
      nodeCount
      edgeCount
      cycleCount
    }
  }
}
```

#### Get Node Dependencies (Upstream)

Get what this node depends on:

```graphql
query GetNodeDependencies($nodeId: String!, $campaignId: ID!) {
  getNodeDependencies(nodeId: $nodeId, campaignId: $campaignId) {
    id
    type
    label
    distance
  }
}
```

#### Get Node Dependents (Downstream)

Get what depends on this node:

```graphql
query GetNodeDependents($nodeId: String!, $campaignId: ID!) {
  getNodeDependents(nodeId: $nodeId, campaignId: $campaignId) {
    id
    type
    label
    distance
  }
}
```

#### Validate Dependency Graph

Check for circular dependencies:

```graphql
query ValidateDependencyGraph($campaignId: ID!, $branchId: ID) {
  validateDependencyGraph(campaignId: $campaignId, branchId: $branchId) {
    isValid
    cycles {
      nodes
      description
    }
  }
}
```

#### Get Evaluation Order

Get topological sort for safe evaluation:

```graphql
query GetEvaluationOrder($campaignId: ID!, $branchId: ID) {
  getEvaluationOrder(campaignId: $campaignId, branchId: $branchId)
  # Returns: ["node-1", "node-2", "node-3", ...]
}
```

---

### Effect Queries (JSON Patch)

World state mutations via JSON Patch operations.

#### Get Single Effect

```graphql
query GetEffect($id: ID!) {
  getEffect(id: $id) {
    id
    entityId
    entityType
    targetType
    targetId
    timing
    jsonPatch
    description
    version
  }
}
```

#### List Effects

```graphql
query ListEffects($entityId: ID, $timing: EffectTiming, $limit: Int, $offset: Int) {
  listEffects(entityId: $entityId, timing: $timing, limit: $limit, offset: $offset) {
    id
    entityId
    targetType
    targetId
    timing
    jsonPatch
  }
}
```

#### Get Effects for Entity

```graphql
query GetEffectsForEntity($entityId: ID!, $timing: EffectTiming!) {
  getEffectsForEntity(entityId: $entityId, timing: $timing) {
    id
    targetType
    targetId
    jsonPatch
    description
  }
}
```

**Variables:**

```json
{
  "entityId": "event-festival",
  "timing": "POST"
}
```

**Response Example:**

```json
{
  "data": {
    "getEffectsForEntity": [
      {
        "id": "effect-1",
        "targetType": "Settlement",
        "targetId": "settlement-sandpoint",
        "jsonPatch": [
          {
            "op": "replace",
            "path": "/variables/morale",
            "value": 85
          }
        ],
        "description": "Increase morale after successful festival"
      }
    ]
  }
}
```

---

### Spatial Queries (PostGIS)

Geographic operations with distance calculations.

#### Get Map Layer (Public)

Get GeoJSON for map viewport:

```graphql
query GetMapLayer($worldId: ID!, $zoom: Int, $bounds: GeoJSON) {
  mapLayer(worldId: $worldId, zoom: $zoom, bounds: $bounds) {
    type
    features {
      type
      geometry {
        type
        coordinates
      }
      properties
    }
  }
}
```

**Note**: This query is public (no authentication required).

#### Find Locations Near Point

```graphql
query LocationsNear($worldId: ID!, $point: GeoJSON!, $radiusKm: Float!) {
  locationsNear(worldId: $worldId, point: $point, radiusKm: $radiusKm) {
    location {
      id
      name
      locationType
    }
    distanceKm
  }
}
```

**Variables:**

```json
{
  "worldId": "world-1",
  "point": {
    "type": "Point",
    "coordinates": [-123.356, 48.407]
  },
  "radiusKm": 50.0
}
```

#### Find Locations in Region

```graphql
query LocationsInRegion($worldId: ID!, $region: GeoJSON!) {
  locationsInRegion(worldId: $worldId, region: $region) {
    id
    name
    locationType
    geojson
  }
}
```

**Variables:**

```json
{
  "worldId": "world-1",
  "region": {
    "type": "Polygon",
    "coordinates": [
      [
        [-124.0, 48.0],
        [-123.0, 48.0],
        [-123.0, 49.0],
        [-124.0, 49.0],
        [-124.0, 48.0]
      ]
    ]
  }
}
```

#### Check Region Overlap

```graphql
query CheckRegionOverlap($region1: GeoJSON!, $region2: GeoJSON!) {
  checkRegionOverlap(region1: $region1, region2: $region2) {
    overlaps
    intersectionArea
    overlapPercentage
  }
}
```

#### Find Settlements Near Point

```graphql
query SettlementsNear($worldId: ID!, $point: GeoJSON!, $radiusKm: Float!) {
  settlementsNear(worldId: $worldId, point: $point, radiusKm: $radiusKm) {
    settlement {
      id
      name
      settlementType
      level
    }
    distanceKm
  }
}
```

#### Find Settlements in Region

```graphql
query SettlementsInRegion($worldId: ID!, $region: GeoJSON!) {
  settlementsInRegion(worldId: $worldId, region: $region) {
    id
    name
    settlementType
    location {
      id
      name
      geojson
    }
  }
}
```

#### Find Settlement at Location

```graphql
query SettlementAtLocation($locationId: ID!) {
  settlementAtLocation(locationId: $locationId) {
    id
    name
    settlementType
    level
  }
}
```

---

### Audit Queries

Activity logging and change tracking.

#### Get Entity Audit History

```graphql
query EntityAuditHistory(
  $entityId: ID!
  $entityType: String
  $action: String
  $userId: String
  $limit: Int
  $offset: Int
  $sort: String
) {
  entityAuditHistory(
    entityId: $entityId
    entityType: $entityType
    action: $action
    userId: $userId
    limit: $limit
    offset: $offset
    sort: $sort
  ) {
    id
    entityId
    entityType
    action
    changes
    user {
      id
      email
    }
    timestamp
    metadata
  }
}
```

**Variables:**

```json
{
  "entityId": "settlement-sandpoint",
  "entityType": "Settlement",
  "limit": 50,
  "sort": "timestamp:desc"
}
```

#### Get User Audit History

```graphql
query UserAuditHistory(
  $userId: String!
  $campaignId: ID
  $startDate: Date
  $endDate: Date
  $limit: Int
  $offset: Int
) {
  userAuditHistory(
    userId: $userId
    campaignId: $campaignId
    startDate: $startDate
    endDate: $endDate
    limit: $limit
    offset: $offset
  ) {
    id
    entityId
    entityType
    action
    timestamp
  }
}
```

---

### Version Queries

Optimistic locking and version history.

#### Get Entity Version History

```graphql
query EntityVersions($entityId: ID!, $entityType: String!, $limit: Int, $offset: Int) {
  entityVersions(entityId: $entityId, entityType: $entityType, limit: $limit, offset: $offset) {
    version
    data
    createdBy {
      id
      email
    }
    createdAt
  }
}
```

#### Get Version Diff

```graphql
query VersionDiff($entityId: ID!, $versionA: Int!, $versionB: Int!) {
  versionDiff(entityId: $entityId, versionA: $versionA, versionB: $versionB) {
    changes {
      field
      oldValue
      newValue
    }
    summary
  }
}
```

---

### Link Queries

Generic entity relationships.

#### Get Single Link

```graphql
query GetLink($id: ID!) {
  link(id: $id) {
    id
    sourceId
    sourceType
    targetId
    targetType
    linkType
    metadata
    version
  }
}
```

#### Get Links by Source

```graphql
query LinksBySource($sourceId: ID!, $linkType: String) {
  linksBySource(sourceId: $sourceId, linkType: $linkType) {
    id
    targetId
    targetType
    linkType
  }
}
```

#### Get Links by Target

```graphql
query LinksByTarget($targetId: ID!, $linkType: String) {
  linksByTarget(targetId: $targetId, linkType: $linkType) {
    id
    sourceId
    sourceType
    linkType
  }
}
```

---

## Utility Queries

### World Time Query

Get current campaign time.

```graphql
query GetCurrentWorldTime($campaignId: ID!) {
  getCurrentWorldTime(campaignId: $campaignId)
  # Returns: "4707-09-21T15:30:00Z"
}
```

---

### Health Check Query

Verify API availability (public).

```graphql
query HealthCheck {
  health {
    status
    timestamp
    version
  }
}
```

**Response Example:**

```json
{
  "data": {
    "health": {
      "status": "ok",
      "timestamp": "2024-11-09T22:30:00Z",
      "version": "1.0.0"
    }
  }
}
```

---

### Cache Statistics Query (Admin Only)

Get cache performance metrics.

```graphql
query GetCacheStats {
  getCacheStats {
    hitRate
    missRate
    totalKeys
    memoryUsage
    performanceMetrics {
      avgResponseTime
      maxResponseTime
    }
  }
}
```

**Note**: Requires admin role.

---

## Query Patterns

### Pagination

Most list queries support offset-based pagination:

```graphql
query PaginatedList($limit: Int, $offset: Int) {
  listStateVariables(limit: $limit, offset: $offset) {
    id
    key
    value
  }
}
```

**Variables:**

```json
{
  "limit": 20,
  "offset": 0
}
```

### Filtering

Many queries support filtering parameters:

```graphql
query FilteredList($scope: String, $limit: Int) {
  listStateVariables(scope: $scope, limit: $limit) {
    id
    key
    value
  }
}
```

### Sorting

Some queries support sorting:

```graphql
query SortedList($sort: String, $limit: Int) {
  listStateVariables(sort: $sort, limit: $limit) {
    id
    key
    value
  }
}
```

**Variables:**

```json
{
  "sort": "key:asc"
}
```

### Field Selection

Only request fields you need to minimize data transfer:

```graphql
# ✅ Good: Select only needed fields
query GetCampaign {
  campaign(id: "campaign-1") {
    id
    name
    currentDate
  }
}

# ❌ Bad: Requesting unnecessary fields
query GetCampaign {
  campaign(id: "campaign-1") {
    id
    name
    description
    world {
      id
      name
      campaigns {
        # Deep nesting increases complexity
      }
    }
  }
}
```

### Aliases

Use aliases to request the same field with different parameters:

```graphql
query MultipleSettlements {
  sandpoint: settlement(id: "settlement-sandpoint") {
    id
    name
    level
  }
  magnimar: settlement(id: "settlement-magnimar") {
    id
    name
    level
  }
}
```

### Fragments

Use fragments to reuse field selections:

```graphql
fragment SettlementFields on Settlement {
  id
  name
  settlementType
  level
  xp
}

query GetSettlements {
  settlementsByKingdom(kingdomId: "kingdom-1") {
    ...SettlementFields
  }
  settlement(id: "settlement-sandpoint") {
    ...SettlementFields
  }
}
```

---

## Best Practices

### 1. Use DataLoaders for N+1 Prevention

DataLoaders are automatically used by field resolvers. Request related entities in a single query:

```graphql
# ✅ Good: Single query with nested fields
query GetEvents {
  eventsByCampaign(campaignId: "campaign-1") {
    id
    name
    location {
      # DataLoader batches these requests
      id
      name
    }
  }
}
```

### 2. Request Only Needed Fields

Avoid over-fetching data:

```graphql
# ✅ Good: Minimal fields
query GetCampaigns {
  campaigns {
    id
    name
  }
}

# ❌ Bad: Unnecessary fields
query GetCampaigns {
  campaigns {
    id
    name
    description
    createdAt
    updatedAt
    version
    world {
      # Not needed
    }
  }
}
```

### 3. Use Variables for Dynamic Queries

Always use variables instead of inline values:

```graphql
# ✅ Good: Variables
query GetCampaign($id: ID!) {
  campaign(id: $id) {
    id
    name
  }
}

# ❌ Bad: Inline values
query GetCampaign {
  campaign(id: "campaign-1") {
    id
    name
  }
}
```

### 4. Handle Nullable Fields

Check for null values in your client code:

```typescript
const { data } = await client.query({
  query: GET_CAMPAIGN,
  variables: { id: 'campaign-1' },
});

if (data.campaign) {
  // Campaign exists
  console.log(data.campaign.name);
} else {
  // Campaign not found
  console.log('Campaign not found');
}
```

### 5. Monitor Query Complexity

Be aware of the 1000 complexity limit. Avoid deeply nested queries:

```graphql
# ⚠️ High complexity: Deep nesting
query ComplexQuery {
  world(id: "world-1") {
    campaigns {
      locations {
        settlements {
          structures {
            # Very deep nesting
          }
        }
      }
    }
  }
}
```

### 6. Use Time-Travel Queries Sparingly

Time-travel queries (`asOf`) are expensive. Use only when necessary:

```graphql
# Use sparingly
query HistoricalState {
  settlementAsOf(id: "settlement-1", worldTime: "4707-09-21T00:00:00Z") {
    id
    variables
  }
}
```

### 7. Leverage Spatial Queries for Map Features

Use spatial queries for map-based features:

```graphql
# Efficient map rendering
query MapData {
  mapLayer(worldId: "world-1", zoom: 8, bounds: $viewportBounds) {
    type
    features {
      geometry
      properties
    }
  }
}
```

---

## Next Steps

- **[Mutations Reference](mutations.md)**: Create, update, and delete entities
- **[Subscriptions Reference](subscriptions.md)**: Real-time updates via WebSockets
- **[Error Handling Guide](error-handling.md)**: Handle GraphQL errors gracefully
- **[GraphQL Overview](graphql-overview.md)**: Schema organization and authentication

---

## Additional Resources

- **GraphQL Playground**: `http://localhost:3000/graphql` (development)
- **Generated Schema**: `packages/api/src/schema.gql`
- **Feature Documentation**: `docs/features/`
