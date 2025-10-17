-- UpdateStateVariableModel
-- This migration transforms the StateVariable model from a simple variable storage
-- to a comprehensive state management system with formulas, audit fields, and versioning

-- Step 1: Rename columns to new semantic names
ALTER TABLE "StateVariable" RENAME COLUMN "name" TO "key";
ALTER TABLE "StateVariable" RENAME COLUMN "entityType" TO "scope";
ALTER TABLE "StateVariable" RENAME COLUMN "entityId" TO "scopeId";

-- Step 2: Modify existing column constraints
-- Change value from NOT NULL to nullable (to support computed values from formulas)
ALTER TABLE "StateVariable" ALTER COLUMN "value" DROP NOT NULL;

-- Step 3: Add new fields
ALTER TABLE "StateVariable" ADD COLUMN "formula" JSONB;
ALTER TABLE "StateVariable" ADD COLUMN "description" TEXT;
ALTER TABLE "StateVariable" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StateVariable" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Step 4: Add audit fields
-- For existing rows, set createdBy to first user in system (or fail if no users exist)
ALTER TABLE "StateVariable" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "StateVariable" ADD COLUMN "updatedBy" TEXT;

-- Step 4a: Populate createdBy for any existing rows
-- Use the first user created in the system as a fallback
UPDATE "StateVariable"
SET "createdBy" = (SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "createdBy" IS NULL;

-- Step 4b: Add CHECK constraint for type field validation
ALTER TABLE "StateVariable" ADD CONSTRAINT "StateVariable_type_check"
    CHECK ("type" IN ('string', 'integer', 'float', 'boolean', 'json', 'derived'));

-- Step 4c: Add CHECK constraint for formula/value relationship
-- Derived variables must have formulas, non-derived variables must have values
ALTER TABLE "StateVariable" ADD CONSTRAINT "StateVariable_formula_value_check"
    CHECK (
        ("type" = 'derived' AND "formula" IS NOT NULL) OR
        ("type" != 'derived' AND "value" IS NOT NULL)
    );

-- Step 5: Drop old indexes and unique constraints
DROP INDEX IF EXISTS "StateVariable_entityType_entityId_idx";
DROP INDEX IF EXISTS "StateVariable_name_idx";
DROP INDEX IF EXISTS "StateVariable_name_entityType_entityId_key";

-- Step 6: Create new indexes matching the renamed columns
-- Composite index for exact lookups by scope/scopeId/key
CREATE INDEX "StateVariable_scope_scopeId_key_idx" ON "StateVariable"("scope", "scopeId", "key");

-- Composite index for common query pattern: get all active variables for a scope
CREATE INDEX "StateVariable_scope_scopeId_isActive_idx"
    ON "StateVariable"("scope", "scopeId", "isActive")
    WHERE "deletedAt" IS NULL;

-- Index on isActive for filtering
CREATE INDEX "StateVariable_isActive_idx" ON "StateVariable"("isActive");

-- Audit indexes - createdBy always populated, updatedBy is sparse (partial index)
CREATE INDEX "StateVariable_createdBy_idx" ON "StateVariable"("createdBy");
CREATE INDEX "StateVariable_updatedBy_idx"
    ON "StateVariable"("updatedBy")
    WHERE "updatedBy" IS NOT NULL;

-- Step 7: Create new unique constraint with deletedAt for soft delete support
-- Including deletedAt allows same (scope, scopeId, key) to be reused after deletion
-- NULL deletedAt values are treated as distinct, so active variables remain unique
CREATE UNIQUE INDEX "StateVariable_scope_scopeId_key_deletedAt_key" ON "StateVariable"("scope", "scopeId", "key", "deletedAt");

-- Step 8: Update existing foreign key constraints to reference new column name
-- The existing foreign keys on entityId will automatically follow the column rename to scopeId
-- No explicit action needed as PostgreSQL handles this during RENAME COLUMN

-- Step 9: Add foreign key constraints for audit fields
-- Note: If there are existing rows, createdBy must be populated first
-- For this migration, we assume the table is empty or will be populated manually
ALTER TABLE "StateVariable" ADD CONSTRAINT "StateVariable_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StateVariable" ADD CONSTRAINT "StateVariable_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 10: Make createdBy NOT NULL after foreign keys are added
-- This is done in a separate step to avoid constraint violations
-- Note: This assumes createdBy has been populated for all existing rows
ALTER TABLE "StateVariable" ALTER COLUMN "createdBy" SET NOT NULL;
