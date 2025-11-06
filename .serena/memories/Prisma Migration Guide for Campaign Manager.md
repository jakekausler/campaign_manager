# Prisma Migration Guide - Campaign Manager

## Quick Reference

### Migration File Locations

- **Migration Directory**: `/storage/programs/campaign_manager/packages/api/prisma/migrations/`
- **Schema File**: `/storage/programs/campaign_manager/packages/api/prisma/schema.prisma`
- **Seed File**: `/storage/programs/campaign_manager/packages/api/prisma/seed.ts`
- **Env File**: `/storage/programs/campaign_manager/packages/api/.env`
- **Example Env**: `/storage/programs/campaign_manager/packages/api/.env.example`

### Database Configuration

- **Type**: PostgreSQL
- **Connection String Format**: `postgresql://user:password@localhost:5432/database_name?schema=public`
- **Environment Variable**: `DATABASE_URL` (set in `.env`)
- **Current Dev Setup**: `postgresql://campaign_user:campaign_pass@localhost:5432/campaign_db?schema=public`
- **Extensions**: PostGIS (postgresqlExtensions preview feature enabled)

---

## Migration Commands

### Available npm Scripts (in packages/api)

Run these from the **project root** using `pnpm --filter @campaign/api`:

```bash
# Create and apply a new migration in dev mode
pnpm --filter @campaign/api prisma:migrate
# Same as: prisma migrate dev

# Deploy existing migrations to production database
pnpm --filter @campaign/api prisma:migrate:deploy
# Same as: prisma migrate deploy

# Generate Prisma Client types (auto-runs after schema changes)
pnpm --filter @campaign/api prisma:generate
# Same as: prisma generate

# Open Prisma Studio (GUI for database inspection/editing)
pnpm --filter @campaign/api prisma:studio

# Seed database with initial data
pnpm --filter @campaign/api prisma:seed

# Reset database (DESTRUCTIVE - deletes all data, re-runs migrations, re-seeds)
pnpm --filter @campaign/api prisma:reset
```

### Direct Prisma Commands (if needed)

From `/storage/programs/campaign_manager/packages/api/`:

```bash
npx prisma migrate dev --name "your_migration_name"
npx prisma migrate deploy
npx prisma generate
npx prisma studio
```

---

## Migration Naming Convention

### Pattern

```
YYYYMMDDHHMMSS_description_in_snake_case
```

### Examples from Existing Migrations

- `20251016012708_init` - Initial schema
- `20251016021954_add_auth_models` - Added authentication models
- `20251016024509_use_enum_for_campaign_role` - Converted field to enum
- `20251016035531_add_archived_at_field` - Added timestamp field
- `20251016135610_add_versioning_system` - Added versioning models
- `20251017034000_add_location_geom_gist_index` - Added spatial index
- `20251020015036_add_encounter_scheduled_at` - Added single timestamp field
- `20251029185204_add_branch_metadata` - Added multiple fields
- `20251030000427_add_merge_history` - Created new table with relations

### Timestamp Format

- YYYYMMDD = Year, Month, Day
- HHMMSS = Hour, Minute, Second (in UTC)
- Use snake_case for description (e.g., `add_field_name`, `update_model_name`)

---

## Migration Directory Structure

Each migration is a **directory** (not a file) containing:

```
migrations/
└── 20251030000427_add_merge_history/
    └── migration.sql              # The actual SQL migration
```

**Key Point**: The migration name is the directory name, and the SQL file is always named `migration.sql`.

---

## How to Create a Migration

### Standard Workflow

1. **Edit the Prisma Schema** (`packages/api/prisma/schema.prisma`)
   - Add new fields to models
   - Create new models
   - Update indexes, constraints, etc.

2. **Create and Apply Migration** (from project root):

   ```bash
   pnpm --filter @campaign/api prisma:migrate
   ```

   This command will:
   - Prompt you for a migration name (use snake_case format)
   - Generate SQL based on schema differences
   - Create migration directory with timestamp + name
   - Run the migration against local database
   - Update `prisma/schema.prisma` to mark applied
   - Regenerate Prisma Client types automatically

3. **Review Generated SQL**
   - Prisma generates the SQL in `migrations/<name>/migration.sql`
   - Review the SQL to ensure it matches your intent
   - If incorrect, you can manually edit the SQL file before running

4. **Commit the Migration**
   - The entire migration directory gets committed to git
   - Both `schema.prisma` changes and migration SQL are version controlled

### Adding a Field to Existing Model (Example)

If adding new fields to the `Audit` model:

**Step 1: Edit schema.prisma**

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  changes    Json
  metadata   Json     @default("{}")
  timestamp  DateTime @default(now())

  // NEW FIELDS
  ipAddress  String?                    // Optional string field
  userAgent  String?                    // Optional string field
  severity   String @default("INFO")    // Required with default

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

**Step 2: Create migration**

```bash
cd /storage/programs/campaign_manager
pnpm --filter @campaign/api prisma:migrate
# When prompted, enter: add_audit_fields
# Or: add_ip_and_user_agent_to_audit
```

**Step 3: Prisma generates migration.sql automatically**

```sql
-- AlterTable
ALTER TABLE "Audit" ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'INFO';
```

---

## SQL Migration Examples from Project

### Adding Simple Fields (20251029185204)

```sql
-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "color" TEXT,
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Branch_campaignId_isPinned_idx" ON "Branch"("campaignId", "isPinned");
```

**Pattern**:

- Use `ALTER TABLE` for modifying existing tables
- Each `ADD COLUMN` on separate line
- Specify defaults for non-nullable fields
- Add indexes after table changes
- Use proper PostgreSQL types (TEXT, BOOLEAN, TEXT[], etc.)

### Adding Single Timestamp Field (20251020015036)

```sql
-- DropIndex
DROP INDEX "public"."Location_geom_gist_idx";

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Encounter_scheduledAt_idx" ON "Encounter"("scheduledAt");
```

**Pattern for timestamps**:

- Use `TIMESTAMP(3)` for precision (milliseconds)
- Index timestamp fields with `@@index([fieldName])`
- Always use camelCase field names

### Creating New Table (20251030000427)

```sql
-- CreateTable
CREATE TABLE "MergeHistory" (
    "id" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "targetBranchId" TEXT NOT NULL,
    "commonAncestorId" TEXT NOT NULL,
    "worldTime" TIMESTAMP(3) NOT NULL,
    "mergedBy" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conflictsCount" INTEGER NOT NULL,
    "entitiesMerged" INTEGER NOT NULL,
    "resolutionsData" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "MergeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MergeHistory_sourceBranchId_idx" ON "MergeHistory"("sourceBranchId");
CREATE INDEX "MergeHistory_targetBranchId_idx" ON "MergeHistory"("targetBranchId");
CREATE INDEX "MergeHistory_mergedBy_idx" ON "MergeHistory"("mergedBy");
CREATE INDEX "MergeHistory_mergedAt_idx" ON "MergeHistory"("mergedAt");

-- AddForeignKey
ALTER TABLE "MergeHistory" ADD CONSTRAINT "MergeHistory_sourceBranchId_fkey"
  FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MergeHistory" ADD CONSTRAINT "MergeHistory_targetBranchId_fkey"
  FOREIGN KEY ("targetBranchId") REFERENCES "Branch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MergeHistory" ADD CONSTRAINT "MergeHistory_mergedBy_fkey"
  FOREIGN KEY ("mergedBy") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Pattern for new tables**:

- `CREATE TABLE "ModelName"` (PascalCase)
- Primary key: `"id" TEXT NOT NULL` with `CONSTRAINT ... PRIMARY KEY ("id")`
- Field names in double quotes and camelCase
- TIMESTAMP(3) for precise timestamps
- JSONB for JSON fields with defaults
- Foreign keys with `ON DELETE` and `ON UPDATE` clauses
- Separate `CREATE INDEX` statements for each index
- Separate `ALTER TABLE` for each foreign key constraint

---

## Field Type Mappings

### Common TypeScript → PostgreSQL Mappings

| Prisma Type               | PostgreSQL Type | Notes                                 |
| ------------------------- | --------------- | ------------------------------------- |
| `String`                  | `TEXT`          | Use for unlimited text                |
| `String?`                 | `TEXT`          | Nullable string                       |
| `Boolean`                 | `BOOLEAN`       | Always include `DEFAULT false/true`   |
| `Int`                     | `INTEGER`       | For numeric values                    |
| `DateTime`                | `TIMESTAMP(3)`  | Always use precision 3                |
| `Json`                    | `JSONB`         | Use JSONB (binary JSON, indexed)      |
| `String[]`                | `TEXT[]`        | Arrays with `DEFAULT ARRAY[]::TEXT[]` |
| `Bytes`                   | `BYTEA`         | For binary/compressed data            |
| `Unsupported("geometry")` | `geometry`      | PostGIS geometry type                 |

### Default Values in SQL

**Syntax**: `DEFAULT <value>`

Examples:

```sql
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "color" TEXT,  -- No default = nullable
```

---

## Post-Migration Steps

### 1. Prisma Client Regeneration

**Automatic**: Running `prisma migrate dev` automatically regenerates Prisma Client types.

**Manual regeneration if needed**:

```bash
pnpm --filter @campaign/api prisma:generate
```

**What it does**:

- Regenerates `packages/api/node_modules/@prisma/client`
- Creates type definitions for all models
- Updates TypeScript intellisense
- Generated files appear in node_modules, NOT committed to git

### 2. Update Services/Resolvers

If adding new fields to a model:

- Update GraphQL types to include new fields
- Update services that use the model
- Update resolvers that query the fields
- Update tests

### 3. Running Tests

After creating a migration that changes schema:

```bash
pnpm --filter @campaign/api test
```

Ensure all existing tests still pass with new schema.

### 4. Commit the Migration

```bash
git add .
git commit -m "feat(api): add fields to audit model

Added ipAddress, userAgent, and severity fields to Audit model
for enhanced tracking of audit events. All fields are optional
except severity which defaults to INFO.

Migration: 20251105_add_audit_fields
"
```

---

## Migration Handling in Development vs Production

### Development Database

- **Setup**: Use local PostgreSQL with `.env` DATABASE_URL
- **Migrations**: Run with `prisma:migrate` (dev mode, creates migrations)
- **Testing**: Test against local database before committing

### Production Database

- **Deployment**: Run `prisma:migrate:deploy` (only applies, doesn't create)
- **Safety**: Always run in a transaction, can rollback if needed
- **Lock**: Prisma uses migration lock to prevent concurrent migrations

### Migration Safety Checklist

1. ✓ **Always add migrations** (don't modify existing .sql files)
2. ✓ **Test locally first** against development database
3. ✓ **Review generated SQL** before committing
4. ✓ **Test with existing data** if schema allows
5. ✓ **Check backcompat** for nullable vs non-nullable
6. ✓ **Add proper defaults** for non-nullable fields
7. ✓ **Index foreign keys** for query performance
8. ✓ **Commit migrations with code changes** that depend on them
9. ✓ **Never edit applied migrations** (create new ones instead)
10. ✓ **Always include migration name in commit message**

---

## Nullable vs Non-Nullable Fields

### Non-Nullable (Required)

```prisma
field String                  // Must provide value
field String @default("text") // Provides default if not supplied
field Boolean @default(false) // Always has a value
```

**In SQL**:

```sql
ADD COLUMN "field" TEXT NOT NULL
ADD COLUMN "field" TEXT NOT NULL DEFAULT 'text'
ADD COLUMN "field" BOOLEAN NOT NULL DEFAULT false
```

**Use case**: For fields that should always have a value

### Nullable (Optional)

```prisma
field String?                 // Can be null
field String? @default(null)  // Optional, explicit null default
```

**In SQL**:

```sql
ADD COLUMN "field" TEXT        -- No NOT NULL = nullable
```

**Use case**: For truly optional data that may not always exist

### Migration Strategy for Nullable/Non-Nullable

**Adding non-nullable field to existing table**:

- Must provide `@default()` in Prisma
- Existing rows will get the default value
- Prisma generates SQL with `DEFAULT` clause

Example:

```prisma
severity String @default("INFO")  // ✓ Safe for existing data
ipAddress String?                 // ✓ Safe - allows null
```

---

## Current Audit Model

**Location**: Line 712-727 in `schema.prisma`

```prisma
model Audit {
  id         String   @id @default(cuid())
  entityType String
  entityId   String
  operation  String
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  changes    Json
  metadata   Json     @default("{}")
  timestamp  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([timestamp])
  @@index([operation])
}
```

**Fields**:

- `id` - Primary key (CUID)
- `entityType` - String type of audited entity
- `entityId` - ID of audited entity
- `operation` - Action: CREATE, UPDATE, DELETE, ARCHIVE, RESTORE, FORK, MERGE, CHERRY_PICK
- `userId` - Who performed action (FK to User)
- `changes` - JSON diff of changes
- `metadata` - JSON for additional context (IP, user agent, etc.)
- `timestamp` - When action occurred

**Indexes**:

- Composite: `[entityType, entityId]` - For entity audit history
- Single: `[userId]` - For user audit history
- Single: `[timestamp]` - For chronological queries
- Single: `[operation]` - For operation filtering

---

## Troubleshooting

### Migration Already Applied

**Error**: "Migration has already been applied"

**Solution**: The migration was already run. It's safe to ignore. Check:

```bash
pnpm --filter @campaign/api prisma migrate status
```

### Database Connection Issues

**Error**: "Can't reach database server"

**Check**:

1. PostgreSQL is running: `psql -U campaign_user -d campaign_db`
2. DATABASE_URL in `.env` is correct
3. Network connectivity to database

### Schema Out of Sync

**Error**: "Prisma schema is out of sync with database"

**Solution**:

```bash
# Option 1: Push schema to database (careful with data!)
pnpm --filter @campaign/api prisma db push

# Option 2: Reset database (DESTRUCTIVE)
pnpm --filter @campaign/api prisma migrate reset
```

### Can't Drop/Modify Field

**Error**: "Cannot drop column, it's still used"

**Solution**: Remove all references first, then create separate migration to drop

---

## Important Notes

1. **Never edit applied migrations** - Always create new ones
2. **Always use `pnpm --filter`** from project root, never `cd` to package
3. **Test migrations locally** before deploying to production
4. **Timestamp precision** is always `TIMESTAMP(3)` (milliseconds)
5. **CUID for IDs** - All primary keys use `@id @default(cuid())`
6. **JSONB for JSON** - Use JSONB (binary) not JSON for performance
7. **Indexes matter** - Add indexes for columns used in WHERE/JOIN clauses
8. **Foreign keys** - Use `ON DELETE RESTRICT` for historical data, `CASCADE` for dependent data
9. **Defaults required** - Non-nullable fields must have `@default()`
10. **Field naming** - Use camelCase in Prisma, becomes snake_case in SQL via `@map` if needed
