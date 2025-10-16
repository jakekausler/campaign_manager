-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Kingdom" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Structure" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "World" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Campaign_archivedAt_idx" ON "Campaign"("archivedAt");

-- CreateIndex
CREATE INDEX "Character_archivedAt_idx" ON "Character"("archivedAt");

-- CreateIndex
CREATE INDEX "Encounter_archivedAt_idx" ON "Encounter"("archivedAt");

-- CreateIndex
CREATE INDEX "Event_archivedAt_idx" ON "Event"("archivedAt");

-- CreateIndex
CREATE INDEX "Kingdom_archivedAt_idx" ON "Kingdom"("archivedAt");

-- CreateIndex
CREATE INDEX "Location_archivedAt_idx" ON "Location"("archivedAt");

-- CreateIndex
CREATE INDEX "Party_archivedAt_idx" ON "Party"("archivedAt");

-- CreateIndex
CREATE INDEX "Settlement_archivedAt_idx" ON "Settlement"("archivedAt");

-- CreateIndex
CREATE INDEX "Structure_archivedAt_idx" ON "Structure"("archivedAt");

-- CreateIndex
CREATE INDEX "World_archivedAt_idx" ON "World"("archivedAt");
