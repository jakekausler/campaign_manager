-- Ensure PostGIS extension is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "srid" INTEGER NOT NULL DEFAULT 3857;

-- CreateIndex
-- Add GIST spatial index on Location.geom for efficient spatial queries
-- Drop existing index if it exists, then create it
DROP INDEX IF EXISTS "Location_geom_gist_idx";
CREATE INDEX "Location_geom_gist_idx" ON "Location" USING gist (geom);
