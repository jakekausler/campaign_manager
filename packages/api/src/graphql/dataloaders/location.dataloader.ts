/**
 * Location DataLoader
 * Batches and caches location queries to prevent N+1 problems
 * Locations are world-scoped and don't require per-user authorization
 */

import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';

import { LocationService, type LocationWithGeometry } from '../services/location.service';

@Injectable()
export class LocationDataLoader {
  constructor(private readonly locationService: LocationService) {}

  /**
   * Create a new DataLoader instance for loading locations by ID
   * Must be called per-request to ensure fresh caching scope
   */
  createLoader(): DataLoader<string, LocationWithGeometry | null> {
    return new DataLoader<string, LocationWithGeometry | null>(
      async (locationIds: readonly string[]) => {
        return this.locationService.findByIds(locationIds);
      }
    );
  }
}
