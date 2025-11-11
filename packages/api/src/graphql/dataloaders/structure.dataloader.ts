/**
 * Structure DataLoader
 * Batches and caches structure queries to prevent N+1 problems
 * IMPORTANT: DataLoader includes user context for authorization
 */

import { Injectable } from '@nestjs/common';
import type { Structure } from '@prisma/client';
import DataLoader from 'dataloader';

import type { AuthenticatedUser } from '../context/graphql-context';
import { StructureService } from '../services/structure.service';

@Injectable()
export class StructureDataLoader {
  constructor(private readonly structureService: StructureService) {}

  /**
   * Create a new DataLoader instance for loading structures by settlement ID
   * Must be called per-request to avoid caching across users
   * Includes user parameter for authorization checks
   * @param user - Authenticated user (required for authorization checks)
   */
  createLoader(user: AuthenticatedUser): DataLoader<string, Structure[]> {
    return new DataLoader<string, Structure[]>(async (settlementIds: readonly string[]) => {
      return this.structureService.findBySettlementIds(settlementIds, user);
    });
  }
}
