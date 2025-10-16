-- =================================================================
-- PostGIS Extension Initialization
-- =================================================================
-- This script is run automatically when PostgreSQL container starts
-- It ensures PostGIS extension is available in the database
-- =================================================================

-- Enable PostGIS extension (includes geometry and geography types)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable PostGIS Topology (optional, for advanced topology features)
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable PostGIS SFCGAL (optional, for 3D operations)
-- CREATE EXTENSION IF NOT EXISTS postgis_sfcgal;

-- Enable PostGIS Raster (optional, for raster data)
-- CREATE EXTENSION IF NOT EXISTS postgis_raster;

-- Enable UUID extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text search similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verify PostGIS installation
SELECT PostGIS_Version();
