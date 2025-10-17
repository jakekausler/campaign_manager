-- DropIndex
DROP INDEX "public"."Location_geom_gist_idx";

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "currentWorldTime" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Campaign_currentWorldTime_idx" ON "Campaign"("currentWorldTime");
