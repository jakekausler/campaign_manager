-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "srid" INTEGER NOT NULL DEFAULT 3857;

-- CreateIndex
-- Add GIST spatial index on Location.geom for efficient spatial queries
CREATE INDEX IF NOT EXISTS "Location_geom_gist_idx" ON "Location" USING GIST (geom);
