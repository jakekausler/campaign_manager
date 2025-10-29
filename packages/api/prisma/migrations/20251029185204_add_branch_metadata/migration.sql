-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "color" TEXT,
ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Branch_campaignId_isPinned_idx" ON "Branch"("campaignId", "isPinned");
