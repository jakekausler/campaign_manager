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

-- CreateIndex
CREATE INDEX "MergeHistory_targetBranchId_idx" ON "MergeHistory"("targetBranchId");

-- CreateIndex
CREATE INDEX "MergeHistory_mergedBy_idx" ON "MergeHistory"("mergedBy");

-- CreateIndex
CREATE INDEX "MergeHistory_mergedAt_idx" ON "MergeHistory"("mergedAt");

-- AddForeignKey
ALTER TABLE "MergeHistory" ADD CONSTRAINT "MergeHistory_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeHistory" ADD CONSTRAINT "MergeHistory_targetBranchId_fkey" FOREIGN KEY ("targetBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergeHistory" ADD CONSTRAINT "MergeHistory_mergedBy_fkey" FOREIGN KEY ("mergedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
