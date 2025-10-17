-- Ensure PostGIS extension is enabled (idempotent - safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateIndex
-- Add GIST spatial index on Location.geom for efficient spatial queries
-- Drop existing index if it exists (for idempotency), then create it
DROP INDEX IF EXISTS "Location_geom_gist_idx";
CREATE INDEX "Location_geom_gist_idx" ON "Location" USING gist (geom);
