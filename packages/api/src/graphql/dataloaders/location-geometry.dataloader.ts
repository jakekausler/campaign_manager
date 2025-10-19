/**
 * Location Geometry DataLoader
 * Batches and caches location geometry queries to prevent N+1 problems
 * Fetches PostGIS geometry data for multiple locations in a single query
 */

import { Injectable, Logger } from '@nestjs/common';
import DataLoader from 'dataloader';

import { PrismaService } from '../../database/prisma.service';

/**
 * Location geometry result from raw query
 */
interface LocationGeometryResult {
  id: string;
  geom: Buffer | null;
}

@Injectable()
export class LocationGeometryDataLoader {
  private readonly logger = new Logger(LocationGeometryDataLoader.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new DataLoader instance for loading location geometries
   * Must be called per-request to avoid caching across requests
   */
  createLoader(): DataLoader<string, Buffer | null> {
    return new DataLoader<string, Buffer | null>(
      async (locationIds: readonly string[]) => {
        try {
          // Fetch geometries for all requested location IDs in a single query
          const results = (await this.prisma.$queryRaw`
            SELECT id, geom
            FROM "Location"
            WHERE id = ANY(${[...locationIds]}::text[])
          `) as LocationGeometryResult[];

          // Create a map for O(1) lookup
          const resultMap = new Map<string, Buffer | null>();
          for (const result of results) {
            resultMap.set(result.id, result.geom);
          }

          // Return results in the same order as input IDs
          // DataLoader requires exact 1:1 mapping of input to output
          return locationIds.map((id) => resultMap.get(id) ?? null);
        } catch (error) {
          this.logger.error(`Failed to batch load location geometries: ${error}`);
          // Return nulls for all IDs on error to prevent DataLoader from failing
          return locationIds.map(() => null);
        }
      },
      {
        // Cache results within this request
        cache: true,
        // Maximum batch size (prevent overly large SQL queries)
        maxBatchSize: 100,
      }
    );
  }
}
