# Encounter Model & Dependency Research

## Encounter Model Schema (from packages/api/prisma/schema.prisma)

```prisma
model Encounter {
  id          String    @id @default(cuid())
  campaignId  String
  campaign    Campaign  @relation(fields: [campaignId], references: [id])
  locationId  String?
  location    Location? @relation(fields: [locationId], references: [id])
  name        String
  description String?
  difficulty  Int?              // Challenge Rating or similar
  scheduledAt DateTime?         // When encounter is scheduled to occur
  isResolved  Boolean   @default(false)
  resolvedAt  DateTime?
  variables   Json      @default("{}")  // Custom data
  version     Int       @default(1)     // For optimistic locking
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  archivedAt  DateTime?

  // Relations
  conditions Condition[]
  effects    Effect[]
  links      Link[]      @relation("EncounterLinks")

  @@index([campaignId])
  @@index([locationId])
  @@index([deletedAt])
  @@index([archivedAt])
  @@index([isResolved])
  @@index([scheduledAt])
}
```

## Dependency Relationships via Link Model

The `Link` model creates dependencies between encounters and events:

```prisma
model Link {
  id          String    @id @default(cuid())
  sourceType  String    // "encounter", "event"
  sourceId    String
  targetType  String    // "encounter", "event"
  targetId    String
  linkType    String    // "prerequisite", "blocks", "triggers", "related"
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?

  // Polymorphic relations for source
  sourceEncounter Encounter? @relation("EncounterLinks", fields: [sourceId], references: [id])
  sourceEvent     Event?     @relation("EventLinks", fields: [sourceId], references: [id])

  @@unique([sourceType, sourceId, targetType, targetId, linkType])
  @@index([sourceType, sourceId])
  @@index([targetType, targetId])
  @@index([linkType])
  @@index([deletedAt])
}
```

### Link Types Available:

- `"prerequisite"` - Source must be completed before target
- `"blocks"` - Source blocks target from occurring
- `"triggers"` - Source triggers target to occur
- `"related"` - Source is related to target

## Current Seed Data Status

- **Events**: 16 events already created with:
  - JSONLogic conditions
  - JSON Patch effects
  - Scheduled times
  - Location associations
  - Condition relationships
  - Effect relationships

- **Encounters**: Currently NO encounters in seed data (to be added)

## Event Creation Pattern (from seed.ts)

Events are created around lines 2240-3100:

- Located in campaign locations (sandpoint, magnimar, etc.)
- Have scheduled times
- Have conditions and effects
- Can be related to settlements

Example structure:

```javascript
const event = await prisma.event.create({
  data: {
    campaignId: campaign.id,
    name: 'Event Name',
    description: 'Description',
    locationId: location.id,
    scheduledAt: new Date('4707-09-21T10:00:00Z'),
    variables: {
      /* custom data */
    },
    // conditions and effects can be added
  },
});
```

## Recommendation for Encounter Dependencies

### Meaningful Dependency Patterns:

1. **Prerequisite Chain**:
   - Encounter 1 → Encounter 2 (prerequisite)
   - Encounter 2 only occurs after Encounter 1 is resolved

2. **Event-Encounter Links**:
   - Event triggers → Encounters spawn as a result
   - Event occurs at location → Multiple encounters must be resolved there

3. **Encounter Sequences**:
   - Minor skirmish → Main battle → Aftermath/Pursuit
   - Each has different difficulty/challenge ratings

4. **Blocked Encounters**:
   - Encounter A blocks Encounter B if conditions aren't met
   - Encounter B can only proceed if A is resolved

5. **Related Encounters**:
   - Multiple encounters at same location
   - Multiple encounters tied to same threat/villain

### Proposed 10+ Encounters:

Location-based groupings:

**Sandpoint (4 encounters):**

1. Festival Celebration (Easy, prerequisite to goblin raid)
2. Goblin Raid Initial (Medium, blocks militia preparation)
3. Goblin Ambush Followup (Medium, triggered by raid)
4. Festival Aftermath Cleanup (Easy, related to celebrations)

**Magnimar (3 encounters):** 5. Trade Fair Merchant Dispute (Medium, prerequisite) 6. Caravan Escort (Hard, triggered by fair disputes) 7. Thieves Guild Heist (Hard, related to urban crime)

**Korvosa (3+ encounters):** 8. Palace Guard Recruitment (Easy) 9. Spy Infiltration (Medium, blocked by recruitment) 10. Royal Assassination Attempt (Hard, triggers spy encounter)

**Wildlands (2+ encounters):** 11. Monster Hunting Contract (Medium) 12. Lair Raid Boss Fight (Hard, prerequisite to loot recovery)

## Implementation Approach:

1. Create 10+ encounters with:
   - Meaningful names related to locations
   - Difficulty ratings (1-5)
   - Scheduled times relative to events
   - Custom variables for context

2. Create Links between encounters:
   - Prerequisite relationships (sequential challenges)
   - Trigger relationships (events cause encounters)
   - Block relationships (conditions affect availability)
   - Related relationships (connected themes)

3. Consider difficulty progression:
   - Early encounters (difficulty 1-2)
   - Mid-campaign (difficulty 2-3)
   - Late/boss encounters (difficulty 4-5)
