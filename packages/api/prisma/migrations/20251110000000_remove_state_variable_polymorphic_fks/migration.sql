-- Remove polymorphic foreign key constraints from StateVariable
-- These constraints cause issues because the same scopeId column
-- points to different tables depending on the 'scope' field value

-- DropForeignKey
ALTER TABLE "StateVariable" DROP CONSTRAINT IF EXISTS "StateVariable_party_fkey";

-- DropForeignKey
ALTER TABLE "StateVariable" DROP CONSTRAINT IF EXISTS "StateVariable_kingdom_fkey";

-- DropForeignKey
ALTER TABLE "StateVariable" DROP CONSTRAINT IF EXISTS "StateVariable_settlement_fkey";

-- DropForeignKey
ALTER TABLE "StateVariable" DROP CONSTRAINT IF EXISTS "StateVariable_structure_fkey";

-- DropForeignKey
ALTER TABLE "StateVariable" DROP CONSTRAINT IF EXISTS "StateVariable_character_fkey";
