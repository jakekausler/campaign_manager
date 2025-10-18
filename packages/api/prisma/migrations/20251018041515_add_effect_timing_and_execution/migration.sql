-- CreateEnum
CREATE TYPE "EffectTiming" AS ENUM ('PRE', 'ON_RESOLVE', 'POST');

-- DropIndex (Prisma doesn't support GIST indexes in schema, so we drop and recreate)
DROP INDEX "public"."Location_geom_gist_idx";

-- AlterTable
ALTER TABLE "Effect" ADD COLUMN     "timing" "EffectTiming" NOT NULL DEFAULT 'ON_RESOLVE',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "EffectExecution" (
    "id" TEXT NOT NULL,
    "effectId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedBy" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "error" TEXT,

    CONSTRAINT "EffectExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EffectExecution_effectId_idx" ON "EffectExecution"("effectId");

-- CreateIndex
CREATE INDEX "EffectExecution_entityType_entityId_idx" ON "EffectExecution"("entityType", "entityId");

-- CreateIndex (Composite index for audit trail pagination queries)
CREATE INDEX "EffectExecution_entityType_entityId_executedAt_idx" ON "EffectExecution"("entityType", "entityId", "executedAt");

-- CreateIndex
CREATE INDEX "EffectExecution_executedAt_idx" ON "EffectExecution"("executedAt");

-- CreateIndex
CREATE INDEX "EffectExecution_executedBy_idx" ON "EffectExecution"("executedBy");

-- CreateIndex
CREATE INDEX "Effect_entityType_entityId_timing_idx" ON "Effect"("entityType", "entityId", "timing");

-- AddForeignKey
ALTER TABLE "EffectExecution" ADD CONSTRAINT "EffectExecution_effectId_fkey" FOREIGN KEY ("effectId") REFERENCES "Effect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate Location GIST index (not supported by Prisma schema)
CREATE INDEX "Location_geom_gist_idx" ON "Location" USING gist (geom);
