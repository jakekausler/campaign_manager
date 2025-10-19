/**
 * Settlement DataLoader
 * Batches and caches settlement queries to prevent N+1 problems
 * Settlements are world-scoped and don't require per-user authorization
 */

import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';

import type { SettlementWithLocation } from '../context/graphql-context';
import { SettlementService } from '../services/settlement.service';

@Injectable()
export class SettlementDataLoader {
  constructor(private readonly settlementService: SettlementService) {}

  /**
   * Create a new DataLoader instance for loading settlements by ID
   * Must be called per-request to ensure fresh caching scope
   */
  createLoader(): DataLoader<string, SettlementWithLocation | null> {
    return new DataLoader<string, SettlementWithLocation | null>(
      async (settlementIds: readonly string[]) => {
        return this.settlementService.findByIds(settlementIds);
      }
    );
  }
}
