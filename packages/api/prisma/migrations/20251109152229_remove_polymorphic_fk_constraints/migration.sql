-- DropForeignKey
ALTER TABLE "public"."Condition" DROP CONSTRAINT "Condition_encounter_fkey";

-- DropForeignKey
ALTER TABLE "public"."Condition" DROP CONSTRAINT "Condition_event_fkey";

-- DropForeignKey
ALTER TABLE "public"."Effect" DROP CONSTRAINT "Effect_encounter_fkey";

-- DropForeignKey
ALTER TABLE "public"."Effect" DROP CONSTRAINT "Effect_event_fkey";

-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "diff" JSONB,
ADD COLUMN     "newState" JSONB,
ADD COLUMN     "previousState" JSONB,
ADD COLUMN     "reason" TEXT;
