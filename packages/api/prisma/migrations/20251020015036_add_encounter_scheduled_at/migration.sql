-- DropIndex
DROP INDEX "public"."Location_geom_gist_idx";

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Encounter_scheduledAt_idx" ON "Encounter"("scheduledAt");
