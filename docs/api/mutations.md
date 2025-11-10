# GraphQL Mutations Reference

This document provides a comprehensive reference for all GraphQL mutations available in the Campaign Manager API, organized by entity type with practical examples for CRUD operations.

## Table of Contents

- [Overview](#overview)
- [Authentication & Authorization](#authentication--authorization)
- [Common Patterns](#common-patterns)
- [Campaign Management](#campaign-management)
- [Geographic Entities](#geographic-entities)
- [Gameplay Entities](#gameplay-entities)
- [Dynamic Variables & Conditions](#dynamic-variables--conditions)
- [Advanced Features](#advanced-features)
- [Complex Operation Examples](#complex-operation-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Overview

The Campaign Manager API exposes **100+ mutation methods** across **20+ resolvers**. Mutations follow consistent patterns for state modification:

- **Create Operations**: `createEntity(input: CreateEntityInput!)`
- **Update Operations**: `updateEntity(id: ID!, input: UpdateEntityInput!)`
- **Delete Operations**: `deleteEntity(id: ID!)`
- **Archive Operations**: `archiveEntity(id: ID!)` (soft delete)
- **Restore Operations**: `restoreEntity(id: ID!)` (unarchive)
- **Workflow Operations**: `completeEvent`, `resolveEncounter`, etc.
- **Advanced Operations**: `forkBranch`, `executeMerge`, `executeEffect`, etc.

All mutations require JWT authentication and most require specific roles (owner or GM).

---

## Authentication & Authorization

### Authentication

All mutations require a valid JWT token in the `Authorization` header:

```http
POST /graphql
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Authorization Patterns

Most mutations use role-based authorization:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'gm')
async updateCampaign(...) { }
```

**Common Role Requirements:**

- **owner** - User owns the world/campaign
- **gm** - User is a Game Master for the campaign
- **player** - User has player access (limited mutations)

Mutations verify that the authenticated user has permission to modify the requested resource.

---

## Common Patterns

### Optimistic Locking

All update operations use optimistic locking to prevent lost updates:

```graphql
mutation UpdateCampaign($id: ID!, $input: UpdateCampaignInput!) {
  updateCampaign(id: $id, input: $input) {
    id
    name
    version # Incremented on each update
  }
}
```

**Variables:**

```json
{
  "id": "campaign-123",
  "input": {
    "name": "Updated Campaign Name",
    "branchId": "main-branch-id",
    "expectedVersion": 5,
    "worldTime": "4707-09-23T12:00:00Z"
  }
}
```

**Key Fields:**

- `branchId` - Branch context for the operation
- `expectedVersion` - Current version number (mutation fails if version changed)
- `worldTime` - Campaign time context (optional)

### Soft Deletes (Archive/Restore)

Entities use soft deletion to preserve data and relationships:

```graphql
# Archive (soft delete)
mutation ArchiveEvent($id: ID!) {
  archiveEvent(id: $id) {
    id
    archivedAt # Timestamp when archived
  }
}

# Restore (unarchive)
mutation RestoreEvent($id: ID!) {
  restoreEvent(id: $id) {
    id
    archivedAt # null after restore
  }
}
```

Hard delete mutations also exist but should be used cautiously:

```graphql
mutation DeleteEvent($id: ID!) {
  deleteEvent(id: $id) # Returns boolean
}
```

### Standard CRUD Pattern

Most entities follow this pattern:

```graphql
# Create
createEntity(input: CreateEntityInput!): Entity!

# Read (see queries.md)
entity(id: ID!): Entity

# Update
updateEntity(id: ID!, input: UpdateEntityInput!): Entity!

# Delete
deleteEntity(id: ID!): Boolean!
archiveEntity(id: ID!): Entity!
restoreEntity(id: ID!): Entity!
```

---

## Campaign Management

### World Mutations

Manage worlds that contain campaigns and geographic data.

#### Create World

```graphql
mutation CreateWorld($input: CreateWorldInput!) {
  createWorld(input: $input) {
    id
    name
    description
    createdAt
    version
  }
}
```

**Variables:**

```json
{
  "input": {
    "name": "Golarion",
    "description": "The primary world of the Pathfinder campaign setting",
    "settings": {
      "timeSystem": "golarion-calendar",
      "defaultTimezone": "Absalom Standard Time"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createWorld": {
      "id": "world-abc123",
      "name": "Golarion",
      "description": "The primary world of the Pathfinder campaign setting",
      "createdAt": "2024-01-15T10:30:00Z",
      "version": 1
    }
  }
}
```

#### Update World

```graphql
mutation UpdateWorld($id: ID!, $input: UpdateWorldInput!) {
  updateWorld(id: $id, input: $input) {
    id
    name
    description
    version
    updatedAt
  }
}
```

**Variables:**

```json
{
  "id": "world-abc123",
  "input": {
    "description": "Updated description for Golarion",
    "settings": {
      "timeSystem": "golarion-calendar",
      "defaultTimezone": "Absalom Standard Time",
      "enableBranching": true
    },
    "branchId": "main-branch-id",
    "expectedVersion": 1
  }
}
```

#### Archive/Restore/Delete World

```graphql
# Archive (soft delete)
mutation ArchiveWorld($id: ID!) {
  archiveWorld(id: $id) {
    id
    archivedAt
  }
}

# Restore
mutation RestoreWorld($id: ID!) {
  restoreWorld(id: $id) {
    id
    archivedAt # null
  }
}

# Hard delete (use with caution)
mutation DeleteWorld($id: ID!) {
  deleteWorld(id: $id) # Returns boolean
}
```

---

### Campaign Mutations

Manage campaigns within a world.

#### Create Campaign

```graphql
mutation CreateCampaign($input: CreateCampaignInput!) {
  createCampaign(input: $input) {
    id
    name
    worldId
    isActive
    currentWorldTime
    createdAt
    version
  }
}
```

**Variables:**

```json
{
  "input": {
    "worldId": "world-abc123",
    "name": "Rise of the Runelords",
    "description": "A campaign set in Varisia exploring ancient Thassilonian ruins",
    "isActive": true,
    "settings": {
      "allowPlayerEdits": false,
      "trackInventory": true,
      "useMilestoneXP": true
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createCampaign": {
      "id": "campaign-xyz789",
      "name": "Rise of the Runelords",
      "worldId": "world-abc123",
      "isActive": true,
      "currentWorldTime": "4707-09-01T00:00:00Z",
      "createdAt": "2024-01-15T10:35:00Z",
      "version": 1
    }
  }
}
```

#### Update Campaign

```graphql
mutation UpdateCampaign($id: ID!, $input: UpdateCampaignInput!) {
  updateCampaign(id: $id, input: $input) {
    id
    name
    isActive
    currentWorldTime
    version
  }
}
```

**Variables:**

```json
{
  "id": "campaign-xyz789",
  "input": {
    "name": "Rise of the Runelords - Varisia Arc",
    "isActive": true,
    "settings": {
      "allowPlayerEdits": false,
      "trackInventory": true,
      "useMilestoneXP": true,
      "enableBranching": true
    },
    "branchId": "main-branch-id",
    "expectedVersion": 1,
    "worldTime": "4707-09-23T12:00:00Z"
  }
}
```

#### Archive/Restore/Delete Campaign

Same pattern as World mutations:

```graphql
archiveCampaign(id: ID!): Campaign!
restoreCampaign(id: ID!): Campaign!
deleteCampaign(id: ID!): Boolean!
```

---

## Geographic Entities

### Location Mutations

Manage locations (regions, landmarks, points of interest).

#### Create Location

```graphql
mutation CreateLocation($input: CreateLocationInput!) {
  createLocation(input: $input) {
    id
    worldId
    campaignId
    name
    locationType
    geometry
    parentLocationId
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "worldId": "world-abc123",
    "campaignId": "campaign-xyz789",
    "name": "Sandpoint",
    "locationType": "town",
    "description": "A sleepy coastal town in southern Varisia",
    "geometry": {
      "type": "Point",
      "coordinates": [-123.45, 45.67]
    },
    "parentLocationId": "location-varisia",
    "properties": {
      "population": 1200,
      "government": "mayor",
      "alignment": "NG"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createLocation": {
      "id": "location-sandpoint",
      "worldId": "world-abc123",
      "campaignId": "campaign-xyz789",
      "name": "Sandpoint",
      "locationType": "town",
      "geometry": {
        "type": "Point",
        "coordinates": [-123.45, 45.67]
      },
      "parentLocationId": "location-varisia",
      "createdAt": "2024-01-15T10:40:00Z"
    }
  }
}
```

#### Update Location

```graphql
mutation UpdateLocation($id: ID!, $input: UpdateLocationInput!) {
  updateLocation(id: $id, input: $input) {
    id
    name
    description
    geometry
    properties
    version
  }
}
```

**Variables:**

```json
{
  "id": "location-sandpoint",
  "input": {
    "description": "A coastal town recovering from the Late Unpleasantness",
    "properties": {
      "population": 1240,
      "government": "mayor",
      "alignment": "NG",
      "notableNPCs": ["Ameiko Kaijitsu", "Sheriff Hemlock"]
    },
    "branchId": "main-branch-id",
    "expectedVersion": 1
  }
}
```

#### Archive/Restore/Delete Location

```graphql
archiveLocation(id: ID!): Location!
restoreLocation(id: ID!): Location!
deleteLocation(id: ID!): Boolean!
```

---

### Settlement Mutations

Manage settlements with typed variables and level progression.

#### Create Settlement

```graphql
mutation CreateSettlement($input: CreateSettlementInput!) {
  createSettlement(input: $input) {
    id
    campaignId
    locationId
    name
    settlementType
    level
    variables
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "locationId": "location-sandpoint",
    "name": "Sandpoint",
    "settlementType": "town",
    "description": "A thriving coastal settlement",
    "level": 3,
    "variables": {
      "population": 1240,
      "morale": 75,
      "prosperity": 60,
      "defense": 40,
      "reputation": 65
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createSettlement": {
      "id": "settlement-sandpoint",
      "campaignId": "campaign-xyz789",
      "locationId": "location-sandpoint",
      "name": "Sandpoint",
      "settlementType": "town",
      "level": 3,
      "variables": {
        "population": 1240,
        "morale": 75,
        "prosperity": 60,
        "defense": 40,
        "reputation": 65
      },
      "createdAt": "2024-01-15T10:45:00Z"
    }
  }
}
```

#### Update Settlement

```graphql
mutation UpdateSettlement($id: ID!, $input: UpdateSettlementInput!) {
  updateSettlement(id: $id, input: $input) {
    id
    name
    variables
    level
    version
  }
}
```

#### Set Settlement Level

```graphql
mutation SetSettlementLevel($id: ID!, $level: Int!) {
  setSettlementLevel(id: $id, level: $level) {
    id
    level
    version
  }
}
```

**Variables:**

```json
{
  "id": "settlement-sandpoint",
  "level": 4
}
```

#### Set Settlement Variable

```graphql
mutation SetSettlementVariable($settlementId: ID!, $input: SetVariableInput!) {
  setSettlementVariable(settlementId: $settlementId, input: $input) {
    name
    value
  }
}
```

**Variables:**

```json
{
  "settlementId": "settlement-sandpoint",
  "input": {
    "name": "morale",
    "value": 80
  }
}
```

**Response:**

```json
{
  "data": {
    "setSettlementVariable": {
      "name": "morale",
      "value": 80
    }
  }
}
```

#### Define Settlement Variable Schema

```graphql
mutation DefineSettlementVariableSchema($id: ID!, $schema: JSON!) {
  defineSettlementVariableSchema(id: $id, schema: $schema) {
    id
    variableSchema
  }
}
```

**Variables:**

```json
{
  "id": "settlement-sandpoint",
  "schema": {
    "type": "object",
    "properties": {
      "population": { "type": "number", "minimum": 0 },
      "morale": { "type": "number", "minimum": 0, "maximum": 100 },
      "prosperity": { "type": "number", "minimum": 0, "maximum": 100 },
      "defense": { "type": "number", "minimum": 0, "maximum": 100 }
    },
    "required": ["population", "morale"]
  }
}
```

#### Archive/Restore/Delete Settlement

```graphql
archiveSettlement(id: ID!): Settlement!
restoreSettlement(id: ID!): Settlement!
deleteSettlement(id: ID!): Boolean!
```

---

### Structure Mutations

Manage structures (buildings) with typed variables and level progression.

#### Create Structure

```graphql
mutation CreateStructure($input: CreateStructureInput!) {
  createStructure(input: $input) {
    id
    campaignId
    settlementId
    name
    structureType
    level
    variables
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "settlementId": "settlement-sandpoint",
    "name": "Sandpoint Cathedral",
    "structureType": "temple",
    "description": "A grand cathedral dedicated to Desna",
    "level": 2,
    "variables": {
      "capacity": 200,
      "holyPower": 85,
      "healingBonus": 10
    }
  }
}
```

#### Set Structure Level

```graphql
mutation SetStructureLevel($id: ID!, $level: Int!) {
  setStructureLevel(id: $id, level: $level) {
    id
    level
    version
  }
}
```

#### Set Structure Variable

```graphql
mutation SetStructureVariable($structureId: ID!, $input: SetVariableInput!) {
  setStructureVariable(structureId: $structureId, input: $input) {
    name
    value
  }
}
```

#### Define Structure Variable Schema

Similar to Settlement variable schema.

#### Archive/Restore/Delete Structure

```graphql
archiveStructure(id: ID!): Structure!
restoreStructure(id: ID!): Structure!
deleteStructure(id: ID!): Boolean!
```

---

### Kingdom Mutations

Manage kingdoms with typed variables and level progression.

#### Create Kingdom

```graphql
mutation CreateKingdom($input: CreateKingdomInput!) {
  createKingdom(input: $input) {
    id
    campaignId
    name
    level
    variables
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "name": "Brevoy",
    "description": "A kingdom in the north",
    "level": 5,
    "variables": {
      "stability": 70,
      "economy": 65,
      "loyalty": 75,
      "unrest": 15
    }
  }
}
```

#### Set Kingdom Level

```graphql
mutation SetKingdomLevel($id: ID!, $level: Int!) {
  setKingdomLevel(id: $id, level: $level) {
    id
    level
    version
  }
}
```

#### Set Kingdom Variable

```graphql
mutation SetKingdomVariable($kingdomId: ID!, $input: SetVariableInput!) {
  setKingdomVariable(kingdomId: $kingdomId, input: $input) {
    name
    value
  }
}
```

#### Define Kingdom Variable Schema

Similar to Settlement variable schema.

#### Archive/Restore/Delete Kingdom

```graphql
archiveKingdom(id: ID!): Kingdom!
restoreKingdom(id: ID!): Kingdom!
deleteKingdom(id: ID!): Boolean!
```

---

## Gameplay Entities

### Event Mutations

Manage events with conditions, effects, and workflow completion.

#### Create Event

```graphql
mutation CreateEvent($input: CreateEventInput!) {
  createEvent(input: $input) {
    id
    campaignId
    locationId
    name
    eventType
    scheduledAt
    status
    variables
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "locationId": "location-sandpoint",
    "name": "Swallowtail Festival",
    "description": "Annual festival celebrating Desna",
    "eventType": "story",
    "scheduledAt": "4707-09-23T10:00:00Z",
    "variables": {
      "attendees": 800,
      "festivalMood": "joyful"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createEvent": {
      "id": "event-festival",
      "campaignId": "campaign-xyz789",
      "locationId": "location-sandpoint",
      "name": "Swallowtail Festival",
      "eventType": "story",
      "scheduledAt": "4707-09-23T10:00:00Z",
      "status": "scheduled",
      "variables": {
        "attendees": 800,
        "festivalMood": "joyful"
      },
      "createdAt": "2024-01-15T10:50:00Z"
    }
  }
}
```

#### Update Event

```graphql
mutation UpdateEvent($id: ID!, $input: UpdateEventInput!) {
  updateEvent(id: $id, input: $input) {
    id
    name
    scheduledAt
    status
    variables
    version
  }
}
```

#### Complete Event

```graphql
mutation CompleteEvent($id: ID!, $resolutionData: JSON) {
  completeEvent(id: $id, resolutionData: $resolutionData) {
    id
    status # "completed"
    completedAt
    resolutionData
    version
  }
}
```

**Variables:**

```json
{
  "id": "event-festival",
  "resolutionData": {
    "outcome": "interrupted",
    "reason": "goblin_raid",
    "casualties": 12,
    "playerActions": ["defended_cathedral", "saved_nobles"]
  }
}
```

**Response:**

```json
{
  "data": {
    "completeEvent": {
      "id": "event-festival",
      "status": "completed",
      "completedAt": "4707-09-23T12:30:00Z",
      "resolutionData": {
        "outcome": "interrupted",
        "reason": "goblin_raid",
        "casualties": 12,
        "playerActions": ["defended_cathedral", "saved_nobles"]
      },
      "version": 3
    }
  }
}
```

#### Expire Event

```graphql
mutation ExpireEvent($id: ID!) {
  expireEvent(id: $id) {
    id
    status # "expired"
    expiredAt
  }
}
```

#### Archive/Restore/Delete Event

```graphql
archiveEvent(id: ID!): Event!
restoreEvent(id: ID!): Event!
deleteEvent(id: ID!): Boolean!
```

---

### Encounter Mutations

Manage encounters with workflow resolution.

#### Create Encounter

```graphql
mutation CreateEncounter($input: CreateEncounterInput!) {
  createEncounter(input: $input) {
    id
    campaignId
    locationId
    name
    encounterType
    difficulty
    status
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "locationId": "location-sandpoint",
    "name": "Goblin Raid",
    "description": "Goblin raiders attack during the festival",
    "encounterType": "combat",
    "difficulty": 2,
    "variables": {
      "goblins": 12,
      "chiefs": 2,
      "surprise": true
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createEncounter": {
      "id": "encounter-goblin-raid",
      "campaignId": "campaign-xyz789",
      "locationId": "location-sandpoint",
      "name": "Goblin Raid",
      "encounterType": "combat",
      "difficulty": 2,
      "status": "pending",
      "createdAt": "2024-01-15T10:55:00Z"
    }
  }
}
```

#### Update Encounter

```graphql
mutation UpdateEncounter($id: ID!, $input: UpdateEncounterInput!) {
  updateEncounter(id: $id, input: $input) {
    id
    name
    difficulty
    status
    version
  }
}
```

#### Resolve Encounter

```graphql
mutation ResolveEncounter($id: ID!, $input: ResolveEncounterInput!) {
  resolveEncounter(id: $id, input: $input) {
    encounter {
      id
      status # "resolved"
      resolvedAt
    }
    outcome
    rewards
    consequences
  }
}
```

**Variables:**

```json
{
  "id": "encounter-goblin-raid",
  "input": {
    "outcome": "victory",
    "partyDamage": 35,
    "enemiesDefeated": 12,
    "loot": {
      "gold": 150,
      "items": ["shortsword", "leather_armor"]
    },
    "notes": "Party defended the cathedral successfully"
  }
}
```

**Response:**

```json
{
  "data": {
    "resolveEncounter": {
      "encounter": {
        "id": "encounter-goblin-raid",
        "status": "resolved",
        "resolvedAt": "4707-09-23T12:30:00Z"
      },
      "outcome": "victory",
      "rewards": {
        "xp": 800,
        "gold": 150,
        "items": ["shortsword", "leather_armor"]
      },
      "consequences": {
        "settlementMorale": -5,
        "reputationChange": 10
      }
    }
  }
}
```

#### Archive/Restore/Delete Encounter

```graphql
archiveEncounter(id: ID!): Encounter!
restoreEncounter(id: ID!): Encounter!
deleteEncounter(id: ID!): Boolean!
```

---

### Party Mutations

Manage adventuring parties with members and level progression.

#### Create Party

```graphql
mutation CreateParty($input: CreatePartyInput!) {
  createParty(input: $input) {
    id
    campaignId
    name
    level
    variables
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "name": "The Heroes of Sandpoint",
    "description": "Defenders of the realm",
    "level": 1,
    "variables": {
      "gold": 100,
      "reputation": 50
    }
  }
}
```

#### Set Party Level

```graphql
mutation SetPartyLevel($id: ID!, $level: Int!) {
  setPartyLevel(id: $id, level: $level) {
    id
    level
    version
  }
}
```

#### Add Party Member

```graphql
mutation AddPartyMember($partyId: ID!, $characterId: ID!, $role: String) {
  addPartyMember(partyId: $partyId, characterId: $characterId, role: $role) {
    id
    partyId
    characterId
    role
    joinedAt
  }
}
```

**Variables:**

```json
{
  "partyId": "party-heroes",
  "characterId": "character-valeros",
  "role": "fighter"
}
```

**Response:**

```json
{
  "data": {
    "addPartyMember": {
      "id": "membership-123",
      "partyId": "party-heroes",
      "characterId": "character-valeros",
      "role": "fighter",
      "joinedAt": "4707-09-23T13:00:00Z"
    }
  }
}
```

#### Remove Party Member

```graphql
mutation RemovePartyMember($partyId: ID!, $characterId: ID!) {
  removePartyMember(partyId: $partyId, characterId: $characterId)
}
```

**Variables:**

```json
{
  "partyId": "party-heroes",
  "characterId": "character-valeros"
}
```

**Response:**

```json
{
  "data": {
    "removePartyMember": true
  }
}
```

#### Set Party Variable

```graphql
mutation SetPartyVariable($partyId: ID!, $input: SetVariableInput!) {
  setPartyVariable(partyId: $partyId, input: $input) {
    name
    value
  }
}
```

#### Define Party Variable Schema

Similar to Settlement variable schema.

#### Archive/Restore/Delete Party

```graphql
archiveParty(id: ID!): Party!
restoreParty(id: ID!): Party!
deleteParty(id: ID!): Boolean!
```

---

### Character Mutations

Manage player and NPC characters.

#### Create Character

```graphql
mutation CreateCharacter($input: CreateCharacterInput!) {
  createCharacter(input: $input) {
    id
    campaignId
    name
    characterType
    level
    variables
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "name": "Valeros",
    "description": "A human fighter from Andoran",
    "characterType": "pc",
    "level": 1,
    "variables": {
      "class": "fighter",
      "str": 16,
      "dex": 14,
      "con": 14,
      "int": 10,
      "wis": 12,
      "cha": 8,
      "hp": 12,
      "ac": 18
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createCharacter": {
      "id": "character-valeros",
      "campaignId": "campaign-xyz789",
      "name": "Valeros",
      "characterType": "pc",
      "level": 1,
      "variables": {
        "class": "fighter",
        "str": 16,
        "dex": 14,
        "con": 14,
        "int": 10,
        "wis": 12,
        "cha": 8,
        "hp": 12,
        "ac": 18
      },
      "createdAt": "2024-01-15T11:00:00Z"
    }
  }
}
```

#### Update Character

```graphql
mutation UpdateCharacter($id: ID!, $input: UpdateCharacterInput!) {
  updateCharacter(id: $id, input: $input) {
    id
    name
    level
    variables
    version
  }
}
```

#### Archive/Restore/Delete Character

```graphql
archiveCharacter(id: ID!): Character!
restoreCharacter(id: ID!): Character!
deleteCharacter(id: ID!): Boolean!
```

---

## Dynamic Variables & Conditions

### State Variable Mutations

Manage state variables with computed values using JSONLogic.

#### Create State Variable

```graphql
mutation CreateStateVariable($input: CreateStateVariableInput!) {
  createStateVariable(input: $input) {
    id
    scope
    scopeId
    key
    type
    value
    formula
    isActive
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "scope": "SETTLEMENT",
    "scopeId": "settlement-sandpoint",
    "key": "totalDefense",
    "type": "DERIVED",
    "formula": {
      "+": [{ "var": "settlement.defense" }, { "var": "garrison.strength" }]
    },
    "description": "Total defense including garrison"
  }
}
```

**Response:**

```json
{
  "data": {
    "createStateVariable": {
      "id": "var-total-defense",
      "scope": "SETTLEMENT",
      "scopeId": "settlement-sandpoint",
      "key": "totalDefense",
      "type": "DERIVED",
      "value": null,
      "formula": {
        "+": [{ "var": "settlement.defense" }, { "var": "garrison.strength" }]
      },
      "isActive": true,
      "createdAt": "2024-01-15T11:05:00Z"
    }
  }
}
```

#### Update State Variable

```graphql
mutation UpdateStateVariable($id: ID!, $input: UpdateStateVariableInput!) {
  updateStateVariable(id: $id, input: $input) {
    id
    key
    value
    formula
    version
  }
}
```

#### Toggle State Variable Active

```graphql
mutation ToggleStateVariableActive($id: ID!, $isActive: Boolean!) {
  toggleStateVariableActive(id: $id, isActive: $isActive) {
    id
    isActive
  }
}
```

**Variables:**

```json
{
  "id": "var-total-defense",
  "isActive": false
}
```

#### Evaluate State Variable

```graphql
mutation EvaluateStateVariable($id: ID!, $context: JSON) {
  evaluateStateVariable(id: $id, context: $context) {
    variableId
    result
    evaluatedAt
  }
}
```

**Variables:**

```json
{
  "id": "var-total-defense",
  "context": {
    "settlement": { "defense": 40 },
    "garrison": { "strength": 25 }
  }
}
```

**Response:**

```json
{
  "data": {
    "evaluateStateVariable": {
      "variableId": "var-total-defense",
      "result": 65,
      "evaluatedAt": "2024-01-15T11:10:00Z"
    }
  }
}
```

#### Delete State Variable

```graphql
mutation DeleteStateVariable($id: ID!) {
  deleteStateVariable(id: $id)
}
```

---

### Field Condition Mutations

Manage field conditions using JSONLogic expressions.

#### Create Field Condition

```graphql
mutation CreateFieldCondition($input: CreateFieldConditionInput!) {
  createFieldCondition(input: $input) {
    id
    entityType
    entityId
    fieldName
    conditionLogic
    isActive
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "entityType": "Event",
    "entityId": "event-festival",
    "fieldName": "canStart",
    "conditionLogic": {
      "and": [
        { ">=": [{ "var": "settlement.morale" }, 50] },
        { ">=": [{ "var": "weather.condition" }, 0] }
      ]
    },
    "description": "Festival can only start if morale is high and weather is good"
  }
}
```

**Response:**

```json
{
  "data": {
    "createFieldCondition": {
      "id": "condition-festival-start",
      "entityType": "Event",
      "entityId": "event-festival",
      "fieldName": "canStart",
      "conditionLogic": {
        "and": [
          { ">=": [{ "var": "settlement.morale" }, 50] },
          { ">=": [{ "var": "weather.condition" }, 0] }
        ]
      },
      "isActive": true,
      "createdAt": "2024-01-15T11:15:00Z"
    }
  }
}
```

#### Update Field Condition

```graphql
mutation UpdateFieldCondition($id: ID!, $input: UpdateFieldConditionInput!) {
  updateFieldCondition(id: $id, input: $input) {
    id
    conditionLogic
    isActive
    version
  }
}
```

#### Toggle Field Condition Active

```graphql
mutation ToggleFieldConditionActive($id: ID!, $isActive: Boolean!) {
  toggleFieldConditionActive(id: $id, isActive: $isActive) {
    id
    isActive
  }
}
```

#### Evaluate Field Condition

```graphql
mutation EvaluateFieldCondition($id: ID!, $context: JSON) {
  evaluateFieldCondition(id: $id, context: $context) {
    conditionId
    result
    evaluatedAt
  }
}
```

**Variables:**

```json
{
  "id": "condition-festival-start",
  "context": {
    "settlement": { "morale": 75 },
    "weather": { "condition": 1 }
  }
}
```

**Response:**

```json
{
  "data": {
    "evaluateFieldCondition": {
      "conditionId": "condition-festival-start",
      "result": true,
      "evaluatedAt": "2024-01-15T11:20:00Z"
    }
  }
}
```

#### Delete Field Condition

```graphql
mutation DeleteFieldCondition($id: ID!) {
  deleteFieldCondition(id: $id)
}
```

---

## Advanced Features

### Effect Mutations

Manage effects that mutate world state using JSON Patch operations.

#### Create Effect

```graphql
mutation CreateEffect($input: CreateEffectInput!) {
  createEffect(input: $input) {
    id
    campaignId
    name
    effectType
    patches
    isActive
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "name": "Goblin Raid Morale Impact",
    "description": "Reduces settlement morale after goblin attack",
    "effectType": "settlement_modifier",
    "patches": [
      {
        "op": "replace",
        "path": "/variables/morale",
        "value": { "$subtract": [{ "var": "current" }, 10] }
      },
      {
        "op": "add",
        "path": "/variables/lastAttack",
        "value": "4707-09-23"
      }
    ],
    "priority": 100
  }
}
```

**Response:**

```json
{
  "data": {
    "createEffect": {
      "id": "effect-goblin-morale",
      "campaignId": "campaign-xyz789",
      "name": "Goblin Raid Morale Impact",
      "effectType": "settlement_modifier",
      "patches": [
        {
          "op": "replace",
          "path": "/variables/morale",
          "value": { "$subtract": [{ "var": "current" }, 10] }
        },
        {
          "op": "add",
          "path": "/variables/lastAttack",
          "value": "4707-09-23"
        }
      ],
      "isActive": true,
      "createdAt": "2024-01-15T11:25:00Z"
    }
  }
}
```

#### Update Effect

```graphql
mutation UpdateEffect($id: ID!, $input: UpdateEffectInput!) {
  updateEffect(id: $id, input: $input) {
    id
    name
    patches
    priority
    version
  }
}
```

#### Toggle Effect Active

```graphql
mutation ToggleEffectActive($id: ID!, $isActive: Boolean!) {
  toggleEffectActive(id: $id, isActive: $isActive) {
    id
    isActive
  }
}
```

#### Execute Effect

```graphql
mutation ExecuteEffect($input: ExecuteEffectInput!) {
  executeEffect(input: $input) {
    success
    appliedPatches
    result
    errors
  }
}
```

**Variables:**

```json
{
  "input": {
    "effectId": "effect-goblin-morale",
    "targetEntityType": "Settlement",
    "targetEntityId": "settlement-sandpoint",
    "context": {
      "current": 75
    },
    "dryRun": false
  }
}
```

**Response:**

```json
{
  "data": {
    "executeEffect": {
      "success": true,
      "appliedPatches": [
        {
          "op": "replace",
          "path": "/variables/morale",
          "value": 65
        },
        {
          "op": "add",
          "path": "/variables/lastAttack",
          "value": "4707-09-23"
        }
      ],
      "result": {
        "variables": {
          "morale": 65,
          "lastAttack": "4707-09-23"
        }
      },
      "errors": null
    }
  }
}
```

#### Execute Effects for Entity

```graphql
mutation ExecuteEffectsForEntity($input: ExecuteEffectsForEntityInput!) {
  executeEffectsForEntity(input: $input) {
    entityType
    entityId
    effectsApplied
    totalPatches
    finalState
  }
}
```

**Variables:**

```json
{
  "input": {
    "entityType": "Settlement",
    "entityId": "settlement-sandpoint",
    "effectIds": ["effect-goblin-morale", "effect-festival-bonus"],
    "context": {
      "current": 75
    }
  }
}
```

#### Delete Effect

```graphql
mutation DeleteEffect($id: ID!) {
  deleteEffect(id: $id)
}
```

---

### Branch Mutations

Manage timeline branches for alternate scenarios.

#### Create Branch

```graphql
mutation CreateBranch($input: CreateBranchInput!) {
  createBranch(input: $input) {
    id
    campaignId
    name
    description
    divergedAt
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "name": "Peaceful Festival",
    "description": "What if the goblin raid was prevented?",
    "divergedAt": "4707-09-23T10:00:00Z"
  }
}
```

**Response:**

```json
{
  "data": {
    "createBranch": {
      "id": "branch-peaceful",
      "campaignId": "campaign-xyz789",
      "name": "Peaceful Festival",
      "description": "What if the goblin raid was prevented?",
      "divergedAt": "4707-09-23T10:00:00Z",
      "createdAt": "2024-01-15T11:30:00Z"
    }
  }
}
```

#### Update Branch

```graphql
mutation UpdateBranch($id: ID!, $input: UpdateBranchInput!) {
  updateBranch(id: $id, input: $input) {
    id
    name
    description
    version
  }
}
```

#### Fork Branch

```graphql
mutation ForkBranch($input: ForkBranchInput!) {
  forkBranch(input: $input) {
    newBranchId
    copiedVersions
    divergedAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "main-branch-id",
    "name": "Shadow Conspiracy",
    "description": "What if the spies weren't detected?",
    "worldTime": "4707-11-15T17:00:00Z",
    "copyHistory": true
  }
}
```

**Response:**

```json
{
  "data": {
    "forkBranch": {
      "newBranchId": "branch-shadow",
      "copiedVersions": 145,
      "divergedAt": "4707-11-15T17:00:00Z"
    }
  }
}
```

#### Delete Branch

```graphql
mutation DeleteBranch($id: ID!) {
  deleteBranch(id: $id)
}
```

---

### Merge Mutations

Manage 3-way merges between branches.

#### Execute Merge

```graphql
mutation ExecuteMerge($input: ExecuteMergeInput!) {
  executeMerge(input: $input) {
    mergeId
    success
    conflicts {
      entityType
      entityId
      field
      baseValue
      sourceValue
      targetValue
    }
    versionsCreated
    entitiesMerged
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "branch-peaceful",
    "targetBranchId": "main-branch-id",
    "worldTime": "4707-10-01T00:00:00Z",
    "resolutions": [
      {
        "entityType": "Settlement",
        "entityId": "settlement-sandpoint",
        "field": "variables.morale",
        "resolvedValue": 80,
        "resolution": "ACCEPT_SOURCE"
      }
    ]
  }
}
```

**Response:**

```json
{
  "data": {
    "executeMerge": {
      "mergeId": "merge-123",
      "success": true,
      "conflicts": [],
      "versionsCreated": 23,
      "entitiesMerged": 15
    }
  }
}
```

#### Cherry Pick Version

```graphql
mutation CherryPickVersion($input: CherryPickVersionInput!) {
  cherryPickVersion(input: $input) {
    id
    branchId
    entityType
    entityId
    version
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "branch-peaceful",
    "targetBranchId": "main-branch-id",
    "entityType": "Event",
    "entityId": "event-festival",
    "sourceVersion": 5,
    "worldTime": "4707-10-01T00:00:00Z"
  }
}
```

**Response:**

```json
{
  "data": {
    "cherryPickVersion": {
      "id": "version-456",
      "branchId": "main-branch-id",
      "entityType": "Event",
      "entityId": "event-festival",
      "version": 6,
      "createdAt": "2024-01-15T11:35:00Z"
    }
  }
}
```

---

### Link Mutations

Manage relationships and dependencies between entities.

#### Create Link

```graphql
mutation CreateLink($input: CreateLinkInput!) {
  createLink(input: $input) {
    id
    campaignId
    linkType
    sourceEntityType
    sourceEntityId
    targetEntityType
    targetEntityId
    metadata
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-xyz789",
    "linkType": "prerequisite",
    "sourceEntityType": "Event",
    "sourceEntityId": "event-festival",
    "targetEntityType": "Encounter",
    "targetEntityId": "encounter-goblin-raid",
    "metadata": {
      "strength": "required",
      "description": "Raid occurs during festival"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createLink": {
      "id": "link-festival-raid",
      "campaignId": "campaign-xyz789",
      "linkType": "prerequisite",
      "sourceEntityType": "Event",
      "sourceEntityId": "event-festival",
      "targetEntityType": "Encounter",
      "targetEntityId": "encounter-goblin-raid",
      "metadata": {
        "strength": "required",
        "description": "Raid occurs during festival"
      },
      "createdAt": "2024-01-15T11:40:00Z"
    }
  }
}
```

#### Update Link

```graphql
mutation UpdateLink($id: ID!, $input: UpdateLinkInput!) {
  updateLink(id: $id, input: $input) {
    id
    metadata
    version
  }
}
```

#### Delete Link

```graphql
mutation DeleteLink($id: ID!) {
  deleteLink(id: $id)
}
```

---

## Error Handling

### GraphQL Error Format

All mutations return errors in GraphQL's standard format:

```json
{
  "errors": [
    {
      "message": "Resource not found",
      "extensions": {
        "code": "NOT_FOUND",
        "entityType": "Settlement",
        "entityId": "settlement-invalid"
      }
    }
  ],
  "data": null
}
```

### Common Error Codes

| Code                    | Description                 | Example                          |
| ----------------------- | --------------------------- | -------------------------------- |
| `UNAUTHENTICATED`       | No valid JWT token provided | Missing or expired token         |
| `FORBIDDEN`             | User lacks permission       | Non-GM trying to delete campaign |
| `NOT_FOUND`             | Entity doesn't exist        | Invalid entity ID                |
| `BAD_USER_INPUT`        | Validation failed           | Invalid email format             |
| `VERSION_CONFLICT`      | Optimistic lock failed      | expectedVersion mismatch         |
| `INTERNAL_SERVER_ERROR` | Server error                | Database connection failure      |

### Validation Errors

Input validation errors include field-specific details:

```json
{
  "errors": [
    {
      "message": "Validation failed",
      "extensions": {
        "code": "BAD_USER_INPUT",
        "validationErrors": [
          {
            "field": "name",
            "message": "Name must not be empty"
          },
          {
            "field": "level",
            "message": "Level must be between 1 and 20"
          }
        ]
      }
    }
  ],
  "data": null
}
```

### Version Conflict Errors

Optimistic locking failures provide conflict details:

```json
{
  "errors": [
    {
      "message": "Version conflict: entity was modified",
      "extensions": {
        "code": "VERSION_CONFLICT",
        "entityType": "Settlement",
        "entityId": "settlement-sandpoint",
        "expectedVersion": 5,
        "actualVersion": 7
      }
    }
  ],
  "data": null
}
```

**Resolution:** Refetch the entity with current version and retry with `expectedVersion: 7`.

### Authorization Errors

```json
{
  "errors": [
    {
      "message": "Insufficient permissions",
      "extensions": {
        "code": "FORBIDDEN",
        "requiredRoles": ["owner", "gm"],
        "userRole": "player"
      }
    }
  ],
  "data": null
}
```

---

## Complex Operation Examples

This section provides comprehensive end-to-end examples for the most complex operations: **branching** (alternate timelines), **merging** (3-way merge with conflict resolution), and **effects** (JSON Patch state mutations).

### Complete Branching Workflow

This example demonstrates creating an alternate timeline branch where a key event outcome changes.

**Scenario:** The party successfully prevents a goblin raid during the Swallowtail Festival. Create a branch to explore what happens if the raid wasn't prevented.

#### Step 1: Query Current State

First, query the current state to understand what needs to diverge:

```graphql
query CurrentCampaignState {
  campaign(id: "campaign-varisia") {
    id
    name
    currentBranch {
      id
      name
    }
    worldTime {
      currentTime
    }
  }

  event(id: "event-swallowtail-festival") {
    id
    name
    completedAt
    resolutionData
  }

  settlement(id: "settlement-sandpoint", branchId: "main") {
    id
    name
    variables
    level
  }
}
```

**Response:**

```json
{
  "data": {
    "campaign": {
      "id": "campaign-varisia",
      "name": "Rise of the Runelords",
      "currentBranch": {
        "id": "branch-main",
        "name": "main"
      },
      "worldTime": {
        "currentTime": "4707-09-25T14:00:00Z"
      }
    },
    "event": {
      "id": "event-swallowtail-festival",
      "name": "Swallowtail Festival",
      "completedAt": "4707-09-23T12:30:00Z",
      "resolutionData": {
        "outcome": "success",
        "raidPrevented": true,
        "casualtiesAvoided": 12
      }
    },
    "settlement": {
      "id": "settlement-sandpoint",
      "name": "Sandpoint",
      "variables": {
        "morale": 85,
        "prosperity": 72,
        "defense": 45
      },
      "level": 3
    }
  }
}
```

#### Step 2: Fork the Branch

Create a new branch that diverges at the moment just before the raid prevention:

```graphql
mutation CreateAlternateBranch($input: ForkBranchInput!) {
  forkBranch(input: $input) {
    newBranchId
    copiedVersions
    divergedAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "branch-main",
    "name": "Goblin Raid Success",
    "description": "Alternate timeline where the goblin raid succeeded and casualties occurred",
    "worldTime": "4707-09-23T10:00:00Z",
    "copyHistory": true,
    "metadata": {
      "scenarioType": "failure",
      "divergenceReason": "goblin_raid_success"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "forkBranch": {
      "newBranchId": "branch-raid-success",
      "copiedVersions": 127,
      "divergedAt": "4707-09-23T10:00:00Z"
    }
  }
}
```

#### Step 3: Update Event Outcome in New Branch

Modify the event outcome in the new branch:

```graphql
mutation ChangeEventOutcome($id: ID!, $input: UpdateEventInput!) {
  updateEvent(id: $id, input: $input) {
    id
    name
    completedAt
    resolutionData
    version
  }
}
```

**Variables:**

```json
{
  "id": "event-swallowtail-festival",
  "input": {
    "branchId": "branch-raid-success",
    "expectedVersion": 1,
    "worldTime": "4707-09-23T12:30:00Z",
    "resolutionData": {
      "outcome": "failure",
      "raidPrevented": false,
      "casualties": 12,
      "buildingsDamaged": 3,
      "stolen": {
        "gold": 500,
        "supplies": ["healing_potions", "weapons"]
      }
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "updateEvent": {
      "id": "event-swallowtail-festival",
      "name": "Swallowtail Festival",
      "completedAt": "4707-09-23T12:30:00Z",
      "resolutionData": {
        "outcome": "failure",
        "raidPrevented": false,
        "casualties": 12,
        "buildingsDamaged": 3,
        "stolen": {
          "gold": 500,
          "supplies": ["healing_potions", "weapons"]
        }
      },
      "version": 2
    }
  }
}
```

#### Step 4: Apply Effects in New Branch

Apply effects to reflect the raid's impact on settlement state:

```graphql
mutation ApplyRaidImpact($input: ExecuteEffectsForEntityInput!) {
  executeEffectsForEntity(input: $input) {
    entityType
    entityId
    effectsApplied
    totalPatches
    finalState
  }
}
```

**Variables:**

```json
{
  "input": {
    "entityType": "Settlement",
    "entityId": "settlement-sandpoint",
    "branchId": "branch-raid-success",
    "effectIds": [
      "effect-goblin-morale-impact",
      "effect-goblin-prosperity-impact",
      "effect-goblin-defense-impact"
    ],
    "context": {
      "casualties": 12,
      "buildingsDamaged": 3,
      "currentMorale": 85,
      "currentProsperity": 72,
      "currentDefense": 45
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "executeEffectsForEntity": {
      "entityType": "Settlement",
      "entityId": "settlement-sandpoint",
      "effectsApplied": 3,
      "totalPatches": 6,
      "finalState": {
        "variables": {
          "morale": 60,
          "prosperity": 58,
          "defense": 52,
          "lastAttackDate": "4707-09-23",
          "raidCasualties": 12,
          "damageLevel": "moderate"
        },
        "level": 3,
        "name": "Sandpoint"
      }
    }
  }
}
```

#### Step 5: Query Both Timelines

Compare the two timelines:

```graphql
query CompareBranches {
  mainTimeline: settlement(id: "settlement-sandpoint", branchId: "branch-main") {
    id
    name
    variables
    branch {
      id
      name
    }
  }

  alternateTimeline: settlement(id: "settlement-sandpoint", branchId: "branch-raid-success") {
    id
    name
    variables
    branch {
      id
      name
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "mainTimeline": {
      "id": "settlement-sandpoint",
      "name": "Sandpoint",
      "variables": {
        "morale": 85,
        "prosperity": 72,
        "defense": 45
      },
      "branch": {
        "id": "branch-main",
        "name": "main"
      }
    },
    "alternateTimeline": {
      "id": "settlement-sandpoint",
      "name": "Sandpoint",
      "variables": {
        "morale": 60,
        "prosperity": 58,
        "defense": 52,
        "lastAttackDate": "4707-09-23",
        "raidCasualties": 12,
        "damageLevel": "moderate"
      },
      "branch": {
        "id": "branch-raid-success",
        "name": "Goblin Raid Success"
      }
    }
  }
}
```

---

### Complete Merging Workflow with Conflict Resolution

This example demonstrates merging changes from a branch back to main, including detecting and resolving conflicts.

**Scenario:** After exploring the "Goblin Raid Success" branch, the GM wants to merge some changes back to main (e.g., improved defenses) while preserving main timeline's morale.

#### Step 1: Preview the Merge

First, preview the merge to identify conflicts:

```graphql
query PreviewMerge($input: PreviewMergeInput!) {
  previewMerge(input: $input) {
    conflicts {
      entityType
      entityId
      field
      baseValue
      sourceValue
      targetValue
      conflictType
    }
    entitiesAffected
    predictedChanges {
      entityType
      entityId
      changedFields
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "branch-raid-success",
    "targetBranchId": "branch-main",
    "worldTime": "4707-09-25T14:00:00Z"
  }
}
```

**Response:**

```json
{
  "data": {
    "previewMerge": {
      "conflicts": [
        {
          "entityType": "Settlement",
          "entityId": "settlement-sandpoint",
          "field": "variables.morale",
          "baseValue": 85,
          "sourceValue": 60,
          "targetValue": 85,
          "conflictType": "BOTH_MODIFIED"
        },
        {
          "entityType": "Settlement",
          "entityId": "settlement-sandpoint",
          "field": "variables.prosperity",
          "baseValue": 72,
          "sourceValue": 58,
          "targetValue": 75,
          "conflictType": "BOTH_MODIFIED"
        },
        {
          "entityType": "Settlement",
          "entityId": "settlement-sandpoint",
          "field": "variables.defense",
          "baseValue": 45,
          "sourceValue": 52,
          "targetValue": 45,
          "conflictType": "SOURCE_MODIFIED"
        }
      ],
      "entitiesAffected": 5,
      "predictedChanges": [
        {
          "entityType": "Settlement",
          "entityId": "settlement-sandpoint",
          "changedFields": ["variables.morale", "variables.prosperity", "variables.defense"]
        },
        {
          "entityType": "Event",
          "entityId": "event-defense-improvements",
          "changedFields": ["resolutionData"]
        }
      ]
    }
  }
}
```

#### Step 2: Execute Merge with Conflict Resolution

Resolve conflicts by choosing which values to keep:

```graphql
mutation MergeBranchesWithResolution($input: ExecuteMergeInput!) {
  executeMerge(input: $input) {
    mergeId
    success
    conflicts {
      entityType
      entityId
      field
      baseValue
      sourceValue
      targetValue
    }
    versionsCreated
    entitiesMerged
    mergeHistory {
      id
      createdAt
      mergedBy {
        id
        username
      }
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "branch-raid-success",
    "targetBranchId": "branch-main",
    "worldTime": "4707-09-25T14:00:00Z",
    "resolutions": [
      {
        "entityType": "Settlement",
        "entityId": "settlement-sandpoint",
        "field": "variables.morale",
        "resolvedValue": 85,
        "resolution": "ACCEPT_TARGET",
        "reason": "Keep main timeline's positive morale"
      },
      {
        "entityType": "Settlement",
        "entityId": "settlement-sandpoint",
        "field": "variables.prosperity",
        "resolvedValue": 75,
        "resolution": "ACCEPT_TARGET",
        "reason": "Main timeline prosperity is better"
      },
      {
        "entityType": "Settlement",
        "entityId": "settlement-sandpoint",
        "field": "variables.defense",
        "resolvedValue": 52,
        "resolution": "ACCEPT_SOURCE",
        "reason": "Merge improved defense from alternate timeline"
      }
    ],
    "metadata": {
      "mergeReason": "Incorporate defense improvements from alternate scenario",
      "reviewedBy": "gm-user-123"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "executeMerge": {
      "mergeId": "merge-raid-to-main",
      "success": true,
      "conflicts": [],
      "versionsCreated": 8,
      "entitiesMerged": 5,
      "mergeHistory": {
        "id": "merge-history-456",
        "createdAt": "2024-01-15T14:30:00Z",
        "mergedBy": {
          "id": "user-gm-001",
          "username": "GameMaster"
        }
      }
    }
  }
}
```

#### Step 3: Verify Merged State

Query the merged state to confirm the resolution:

```graphql
query VerifyMergedState {
  settlement(id: "settlement-sandpoint", branchId: "branch-main") {
    id
    name
    variables
    version
    updatedAt
  }
}
```

**Response:**

```json
{
  "data": {
    "settlement": {
      "id": "settlement-sandpoint",
      "name": "Sandpoint",
      "variables": {
        "morale": 85,
        "prosperity": 75,
        "defense": 52,
        "lastDefenseUpgrade": "4707-09-25"
      },
      "version": 9,
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  }
}
```

#### Step 4: Cherry-Pick Specific Changes (Optional)

If you only want specific changes, use cherry-pick instead of full merge:

```graphql
mutation CherryPickDefenseUpgrade($input: CherryPickVersionInput!) {
  cherryPickVersion(input: $input) {
    id
    branchId
    entityType
    entityId
    version
    snapshot
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "sourceBranchId": "branch-raid-success",
    "targetBranchId": "branch-main",
    "entityType": "Settlement",
    "entityId": "settlement-sandpoint",
    "sourceVersion": 4,
    "worldTime": "4707-09-25T14:00:00Z",
    "metadata": {
      "reason": "Apply only defense improvements without other changes"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "cherryPickVersion": {
      "id": "version-settlement-sandpoint-10",
      "branchId": "branch-main",
      "entityType": "Settlement",
      "entityId": "settlement-sandpoint",
      "version": 10,
      "snapshot": {
        "id": "settlement-sandpoint",
        "name": "Sandpoint",
        "variables": {
          "morale": 85,
          "prosperity": 75,
          "defense": 52
        },
        "level": 3
      },
      "createdAt": "2024-01-15T14:35:00Z"
    }
  }
}
```

---

### Complete Effect Execution Workflow

This example demonstrates creating, testing, and applying complex JSON Patch effects that mutate world state.

**Scenario:** Create an effect that represents a festival boosting settlement morale, prosperity, and marking the festival date, then apply it to multiple settlements.

#### Step 1: Create the Effect

Define a reusable effect with JSON Patch operations:

```graphql
mutation CreateFestivalEffect($input: CreateEffectInput!) {
  createEffect(input: $input) {
    id
    campaignId
    name
    description
    effectType
    patches
    priority
    isActive
    createdAt
  }
}
```

**Variables:**

```json
{
  "input": {
    "campaignId": "campaign-varisia",
    "name": "Swallowtail Festival Success",
    "description": "Boosts settlement morale and prosperity after a successful festival, with diminishing returns based on current prosperity",
    "effectType": "settlement_modifier",
    "patches": [
      {
        "op": "replace",
        "path": "/variables/morale",
        "value": {
          "$min": [
            100,
            {
              "$add": [{ "var": "variables.morale" }, 15]
            }
          ]
        }
      },
      {
        "op": "replace",
        "path": "/variables/prosperity",
        "value": {
          "$min": [
            100,
            {
              "$add": [
                { "var": "variables.prosperity" },
                {
                  "$subtract": [
                    10,
                    {
                      "$divide": [{ "var": "variables.prosperity" }, 20]
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        "op": "add",
        "path": "/variables/lastFestivalDate",
        "value": { "var": "festivalDate" }
      },
      {
        "op": "add",
        "path": "/variables/festivalCount",
        "value": {
          "$add": [
            {
              "$or": [{ "var": "variables.festivalCount" }, 0]
            },
            1
          ]
        }
      }
    ],
    "priority": 100,
    "metadata": {
      "category": "event_outcome",
      "duration": "instant",
      "tags": ["festival", "morale", "prosperity"]
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "createEffect": {
      "id": "effect-festival-success",
      "campaignId": "campaign-varisia",
      "name": "Swallowtail Festival Success",
      "description": "Boosts settlement morale and prosperity after a successful festival, with diminishing returns based on current prosperity",
      "effectType": "settlement_modifier",
      "patches": [
        {
          "op": "replace",
          "path": "/variables/morale",
          "value": {
            "$min": [100, { "$add": [{ "var": "variables.morale" }, 15] }]
          }
        },
        {
          "op": "replace",
          "path": "/variables/prosperity",
          "value": {
            "$min": [
              100,
              {
                "$add": [
                  { "var": "variables.prosperity" },
                  { "$subtract": [10, { "$divide": [{ "var": "variables.prosperity" }, 20] }] }
                ]
              }
            ]
          }
        },
        {
          "op": "add",
          "path": "/variables/lastFestivalDate",
          "value": { "var": "festivalDate" }
        },
        {
          "op": "add",
          "path": "/variables/festivalCount",
          "value": {
            "$add": [{ "$or": [{ "var": "variables.festivalCount" }, 0] }, 1]
          }
        }
      ],
      "priority": 100,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

#### Step 2: Dry-Run Test the Effect

Test the effect without applying it to see what changes would occur:

```graphql
mutation TestFestivalEffect($input: ExecuteEffectInput!) {
  executeEffect(input: $input) {
    success
    appliedPatches
    result
    errors
  }
}
```

**Variables:**

```json
{
  "input": {
    "effectId": "effect-festival-success",
    "targetEntityType": "Settlement",
    "targetEntityId": "settlement-sandpoint",
    "branchId": "branch-main",
    "context": {
      "festivalDate": "4707-09-23"
    },
    "dryRun": true
  }
}
```

**Response:**

```json
{
  "data": {
    "executeEffect": {
      "success": true,
      "appliedPatches": [
        {
          "op": "replace",
          "path": "/variables/morale",
          "value": 100
        },
        {
          "op": "replace",
          "path": "/variables/prosperity",
          "value": 78
        },
        {
          "op": "add",
          "path": "/variables/lastFestivalDate",
          "value": "4707-09-23"
        },
        {
          "op": "add",
          "path": "/variables/festivalCount",
          "value": 1
        }
      ],
      "result": {
        "id": "settlement-sandpoint",
        "name": "Sandpoint",
        "variables": {
          "morale": 100,
          "prosperity": 78,
          "defense": 45,
          "lastFestivalDate": "4707-09-23",
          "festivalCount": 1
        },
        "level": 3
      },
      "errors": null
    }
  }
}
```

#### Step 3: Apply Effect to Target Settlement

Apply the effect for real:

```graphql
mutation ApplyFestivalEffect($input: ExecuteEffectInput!) {
  executeEffect(input: $input) {
    success
    appliedPatches
    result
    errors
  }
}
```

**Variables:**

```json
{
  "input": {
    "effectId": "effect-festival-success",
    "targetEntityType": "Settlement",
    "targetEntityId": "settlement-sandpoint",
    "branchId": "branch-main",
    "worldTime": "4707-09-23T18:00:00Z",
    "context": {
      "festivalDate": "4707-09-23"
    },
    "dryRun": false
  }
}
```

**Response:**

```json
{
  "data": {
    "executeEffect": {
      "success": true,
      "appliedPatches": [
        {
          "op": "replace",
          "path": "/variables/morale",
          "value": 100
        },
        {
          "op": "replace",
          "path": "/variables/prosperity",
          "value": 78
        },
        {
          "op": "add",
          "path": "/variables/lastFestivalDate",
          "value": "4707-09-23"
        },
        {
          "op": "add",
          "path": "/variables/festivalCount",
          "value": 1
        }
      ],
      "result": {
        "id": "settlement-sandpoint",
        "name": "Sandpoint",
        "variables": {
          "morale": 100,
          "prosperity": 78,
          "defense": 45,
          "lastFestivalDate": "4707-09-23",
          "festivalCount": 1
        },
        "level": 3,
        "version": 5,
        "updatedAt": "2024-01-15T10:15:00Z"
      },
      "errors": null
    }
  }
}
```

#### Step 4: Batch Apply to Multiple Settlements

Apply the same effect to multiple settlements using `executeEffectsForEntity`:

```graphql
mutation ApplyRegionalFestivalBoost($magnimar: ExecuteEffectInput!, $korvosa: ExecuteEffectInput!) {
  magnimar: executeEffect(input: $magnimar) {
    success
    result
  }

  korvosa: executeEffect(input: $korvosa) {
    success
    result
  }
}
```

**Variables:**

```json
{
  "magnimar": {
    "effectId": "effect-festival-success",
    "targetEntityType": "Settlement",
    "targetEntityId": "settlement-magnimar",
    "branchId": "branch-main",
    "worldTime": "4707-09-23T18:00:00Z",
    "context": {
      "festivalDate": "4707-09-23"
    },
    "dryRun": false
  },
  "korvosa": {
    "effectId": "effect-festival-success",
    "targetEntityType": "Settlement",
    "targetEntityId": "settlement-korvosa",
    "branchId": "branch-main",
    "worldTime": "4707-09-23T18:00:00Z",
    "context": {
      "festivalDate": "4707-09-23"
    },
    "dryRun": false
  }
}
```

**Response:**

```json
{
  "data": {
    "magnimar": {
      "success": true,
      "result": {
        "id": "settlement-magnimar",
        "name": "Magnimar",
        "variables": {
          "morale": 93,
          "prosperity": 84,
          "lastFestivalDate": "4707-09-23",
          "festivalCount": 3
        }
      }
    },
    "korvosa": {
      "success": true,
      "result": {
        "id": "settlement-korvosa",
        "name": "Korvosa",
        "variables": {
          "morale": 88,
          "prosperity": 90,
          "lastFestivalDate": "4707-09-23",
          "festivalCount": 2
        }
      }
    }
  }
}
```

#### Step 5: Chain Multiple Effects

Apply multiple effects in sequence for complex state changes:

```graphql
mutation ApplyEventEffectsChain($input: ExecuteEffectsForEntityInput!) {
  executeEffectsForEntity(input: $input) {
    entityType
    entityId
    effectsApplied
    totalPatches
    finalState
    executionOrder {
      effectId
      effectName
      priority
      patchesApplied
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "entityType": "Settlement",
    "entityId": "settlement-sandpoint",
    "branchId": "branch-main",
    "worldTime": "4707-09-23T20:00:00Z",
    "effectIds": [
      "effect-festival-success",
      "effect-trade-route-established",
      "effect-diplomatic-relations-improved"
    ],
    "context": {
      "festivalDate": "4707-09-23",
      "tradePartner": "Magnimar",
      "diplomacyTarget": "Shoanti Tribes",
      "relationshipLevel": "friendly"
    }
  }
}
```

**Response:**

```json
{
  "data": {
    "executeEffectsForEntity": {
      "entityType": "Settlement",
      "entityId": "settlement-sandpoint",
      "effectsApplied": 3,
      "totalPatches": 11,
      "finalState": {
        "id": "settlement-sandpoint",
        "name": "Sandpoint",
        "variables": {
          "morale": 100,
          "prosperity": 85,
          "defense": 45,
          "diplomacy": 62,
          "lastFestivalDate": "4707-09-23",
          "festivalCount": 1,
          "tradeRoutes": ["Magnimar"],
          "allies": ["Shoanti Tribes"]
        },
        "level": 3,
        "version": 8
      },
      "executionOrder": [
        {
          "effectId": "effect-diplomatic-relations-improved",
          "effectName": "Diplomatic Relations Improved",
          "priority": 150,
          "patchesApplied": 2
        },
        {
          "effectId": "effect-festival-success",
          "effectName": "Swallowtail Festival Success",
          "priority": 100,
          "patchesApplied": 4
        },
        {
          "effectId": "effect-trade-route-established",
          "effectName": "Trade Route Established",
          "priority": 75,
          "patchesApplied": 5
        }
      ]
    }
  }
}
```

---

## Best Practices

### 1. Always Use Optimistic Locking

For all update operations, include `branchId` and `expectedVersion`:

```graphql
mutation UpdateSettlement($id: ID!, $input: UpdateSettlementInput!) {
  updateSettlement(id: $id, input: $input) {
    id
    name
    version # Always return version for next update
  }
}
```

**Variables:**

```json
{
  "input": {
    "name": "Updated Name",
    "branchId": "main-branch-id",
    "expectedVersion": 5 // Required!
  }
}
```

### 2. Handle Version Conflicts Gracefully

When you get a `VERSION_CONFLICT` error:

1. Refetch the current entity state
2. Merge your changes with the current state
3. Retry with the new `expectedVersion`

```typescript
async function updateWithRetry(id: string, changes: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Fetch current state
      const current = await fetchEntity(id);

      // Merge changes
      const merged = { ...changes, expectedVersion: current.version };

      // Attempt update
      return await updateEntity(id, merged);
    } catch (error) {
      if (error.extensions?.code !== 'VERSION_CONFLICT' || i === maxRetries - 1) {
        throw error;
      }
    }
  }
}
```

### 3. Use Soft Deletes (Archive) by Default

Prefer `archiveEntity` over `deleteEntity` to preserve data:

```graphql
# Preferred
mutation {
  archiveSettlement(id: "settlement-123") {
    id
    archivedAt
  }
}

# Use only when absolutely necessary
mutation {
  deleteSettlement(id: "settlement-123")
}
```

### 4. Validate Input Client-Side

Reduce round trips by validating input before sending:

```typescript
function validateSettlementInput(input: CreateSettlementInput) {
  if (!input.name || input.name.trim() === '') {
    throw new Error('Name is required');
  }
  if (input.level && (input.level < 1 || input.level > 20)) {
    throw new Error('Level must be between 1 and 20');
  }
  // ... more validation
}
```

### 5. Use Batch Operations When Available

Instead of multiple individual mutations:

```graphql
# Less efficient
mutation {
  effect1: executeEffect(input: { effectId: "effect-1", ... })
  effect2: executeEffect(input: { effectId: "effect-2", ... })
  effect3: executeEffect(input: { effectId: "effect-3", ... })
}

# More efficient
mutation {
  executeEffectsForEntity(input: {
    entityType: "Settlement"
    entityId: "settlement-123"
    effectIds: ["effect-1", "effect-2", "effect-3"]
  }) {
    effectsApplied
    finalState
  }
}
```

### 6. Request Only Needed Fields

Keep mutations efficient by requesting only necessary fields:

```graphql
# Good - minimal fields
mutation {
  updateSettlement(id: "123", input: { ... }) {
    id
    version  # Need for next update
  }
}

# Avoid - unnecessary fields
mutation {
  updateSettlement(id: "123", input: { ... }) {
    id
    name
    description
    variables
    level
    # ... many fields you don't need
  }
}
```

### 7. Use Dry Run for Effects

Test effects before applying them:

```graphql
mutation TestEffect($input: ExecuteEffectInput!) {
  executeEffect(input: $input) {
    success
    appliedPatches
    result
    errors
  }
}
```

**Variables:**

```json
{
  "input": {
    "effectId": "effect-123",
    "targetEntityType": "Settlement",
    "targetEntityId": "settlement-123",
    "dryRun": true // Test without applying
  }
}
```

### 8. Include Context in Mutations

Provide meaningful context for audit logs and debugging:

```graphql
mutation CompleteEvent($id: ID!, $resolutionData: JSON) {
  completeEvent(id: $id, resolutionData: $resolutionData) {
    id
    completedAt
    resolutionData
  }
}
```

**Variables:**

```json
{
  "id": "event-123",
  "resolutionData": {
    "outcome": "success",
    "notes": "Players successfully defended the town",
    "playerActions": ["defended_cathedral", "saved_mayor"],
    "timestamp": "4707-09-23T12:30:00Z"
  }
}
```

### 9. Handle Partial Failures in Batch Operations

When executing multiple operations, handle partial failures:

```typescript
async function batchUpdate(entities: Array<{ id: string; changes: any }>) {
  const results = await Promise.allSettled(entities.map((e) => updateEntity(e.id, e.changes)));

  const succeeded = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  if (failed.length > 0) {
    console.warn(`${failed.length} updates failed:`, failed);
  }

  return { succeeded, failed };
}
```

### 10. Use Transactions for Related Mutations

When mutations must succeed or fail together, use a transaction pattern:

```graphql
# Pseudo-code - implement transaction logic server-side
mutation CompleteEventWithEffects($eventId: ID!, $effectIds: [ID!]!) {
  # Complete event
  completeEvent(id: $eventId, resolutionData: { ... })

  # Apply effects
  executeEffectsForEntity(input: {
    entityType: "Event"
    entityId: $eventId
    effectIds: $effectIds
  })
}
```

---

## See Also

- [GraphQL Overview](./graphql-overview.md) - Schema organization and type system
- [Queries Reference](./queries.md) - Query operations and patterns
- [Subscriptions Reference](./subscriptions.md) - Real-time updates
- [Error Handling Guide](./error-handling.md) - Comprehensive error handling
- [Condition System](../features/condition-system.md) - JSONLogic expressions
- [Effect System](../features/effect-system.md) - JSON Patch operations
- [Branching System](../features/branching-system.md) - Timeline management

---

**Last Updated:** 2024-01-15
**API Version:** 1.0.0
