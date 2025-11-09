# Polymorphic Relationships in Prisma

## Overview

This document explains how polymorphic relationships are handled in the Campaign Manager database schema using Prisma ORM.

## The Problem

Prisma does not natively support true polymorphic relationships (where a single foreign key can reference multiple tables). When you define multiple `@relation` directives on the same field pointing to different tables, Prisma creates **multiple foreign key constraints** in PostgreSQL, which causes validation failures.

### Example of the Problem

```prisma
// ❌ This creates TWO FK constraints on entityId
model Condition {
  entityType String
  entityId   String

  encounter Encounter? @relation(fields: [entityId], references: [id])
  event     Event?     @relation(fields: [entityId], references: [id])
}
```

When you try to create a Condition with `entityType: 'EVENT'`, PostgreSQL tries to validate `entityId` against **both** the Encounter table AND the Event table, causing a foreign key violation since the ID doesn't exist in the Encounter table.

## The Solution

Remove the `@relation` directives entirely and handle referential integrity at the **application level** instead of the database level.

### Updated Schema Pattern

```prisma
model Condition {
  id          String   @id @default(cuid())
  name        String
  entityType  String   // "encounter", "event" - determines which entity this belongs to
  entityId    String   // ID of the encounter or event (polymorphic, no FK constraint)

  // Note: Polymorphic relationships without FK constraints
  // Application code enforces referential integrity based on entityType
  // No @relation directives = no foreign key constraints in database

  @@index([entityType, entityId])
}
```

### Application-Level Queries

To query polymorphic relationships, use conditional logic in your application code:

```typescript
// Query conditions for an encounter
const conditions = await prisma.condition.findMany({
  where: {
    entityType: 'ENCOUNTER',
    entityId: encounterId,
  },
});

// Query conditions for an event
const conditions = await prisma.condition.findMany({
  where: {
    entityType: 'EVENT',
    entityId: eventId,
  },
});

// Create a condition for an event
await prisma.condition.create({
  data: {
    name: 'Event Condition',
    entityType: 'EVENT',
    entityId: event.id,
    expression: {
      /* JSONLogic */
    },
  },
});
```

### Referential Integrity

Since there are no database-level foreign key constraints, the application must ensure:

1. **Valid entity types**: Only create records with valid `entityType` values
2. **Entity existence**: Verify the referenced entity exists before creating the polymorphic record
3. **Cascade deletes**: When deleting an entity, manually delete associated polymorphic records

Example helper function:

```typescript
async function deleteEventWithRelations(eventId: string) {
  await prisma.$transaction([
    // Delete polymorphic relations first
    prisma.condition.deleteMany({ where: { entityType: 'EVENT', entityId: eventId } }),
    prisma.effect.deleteMany({ where: { entityType: 'EVENT', entityId: eventId } }),

    // Then delete the event
    prisma.event.delete({ where: { id: eventId } }),
  ]);
}
```

## Models Using Polymorphic Relationships

The following models use this pattern:

### Condition

- **Entity Types**: `ENCOUNTER`, `EVENT`
- **Purpose**: JSONLogic expressions that determine when encounters/events should be available
- **Fields**: `entityType`, `entityId`

### Effect

- **Entity Types**: `ENCOUNTER`, `EVENT`
- **Purpose**: JSON Patch operations that modify game state when encounters/events resolve
- **Fields**: `entityType`, `entityId`

### Link

- **Entity Types**: `ENCOUNTER`, `EVENT` (for both source and target)
- **Purpose**: Represents dependency relationships between encounters and events (prerequisite, triggers, blocks, related)
- **Fields**: `sourceType`, `sourceId`, `targetType`, `targetId`
- **Example Query**:

```typescript
// Find all links from an encounter
const outgoingLinks = await prisma.link.findMany({
  where: {
    sourceType: 'ENCOUNTER',
    sourceId: encounterId,
  },
});

// Find all links to an event
const incomingLinks = await prisma.link.findMany({
  where: {
    targetType: 'EVENT',
    targetId: eventId,
  },
});
```

## Migration History

**Migration 1**: `20251109152229_remove_polymorphic_fk_constraints`

This migration removed the following foreign key constraints:

- `Condition_encounter_fkey`
- `Condition_event_fkey`
- `Effect_encounter_fkey`
- `Effect_event_fkey`

**Migration 2**: `20251109155837_remove_link_foreign_keys`

This migration removed the following foreign key constraints:

- `Link_sourceEncounter_fkey`
- `Link_sourceEvent_fkey`

## Best Practices

1. **Index polymorphic fields**: Always create composite indexes on `[entityType, entityId]` for query performance
2. **Validate entity types**: Use TypeScript enums or string literal types to enforce valid entity types
3. **Document entity types**: Maintain clear documentation of which entity types are supported
4. **Test referential integrity**: Add integration tests to verify orphaned records don't accumulate
5. **Consider constraints**: For critical data integrity, consider adding application-level validation middleware

## Trade-offs

### Advantages

✅ No foreign key constraint conflicts
✅ Flexible schema evolution (easy to add new entity types)
✅ Prisma Client generates without errors

### Disadvantages

❌ No database-level referential integrity
❌ Application must handle cascade deletes manually
❌ Potential for orphaned records if not handled carefully
❌ No automatic type-safe joins in Prisma queries

## Additional Resources

- [Prisma Issue: Polymorphic Relations](https://github.com/prisma/prisma/issues/2505)
- [PostgreSQL Foreign Keys Documentation](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK)
