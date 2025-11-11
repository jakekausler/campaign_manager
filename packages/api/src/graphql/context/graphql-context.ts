/**
 * GraphQL Context Factory
 * Creates context for each GraphQL request including:
 * - Request/Response objects
 * - Authenticated user from JWT
 * - DataLoaders for N+1 prevention
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma, Structure } from '@prisma/client';
import DataLoader from 'dataloader';
import type { Request, Response } from 'express';

import { LocationGeometryDataLoader } from '../dataloaders/location-geometry.dataloader';
import { LocationDataLoader } from '../dataloaders/location.dataloader';
import { SettlementDataLoader } from '../dataloaders/settlement.dataloader';
import { StructureDataLoader } from '../dataloaders/structure.dataloader';
import type { LocationWithGeometry } from '../services/location.service';

// User type from JWT payload
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

// Extended Express Request with user
export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

// Type for Settlement with location relation included (used by SettlementDataLoader)
export type SettlementWithLocation = Prisma.SettlementGetPayload<{ include: { location: true } }>;

// GraphQL Context interface
export interface GraphQLContext {
  req: RequestWithUser;
  res: Response;
  user?: AuthenticatedUser;
  dataloaders: DataLoaders;
}

// DataLoaders interface
export interface DataLoaders {
  locationLoader: DataLoader<string, LocationWithGeometry | null>;
  locationGeometryLoader: DataLoader<string, Buffer | null>;
  settlementLoader: DataLoader<string, SettlementWithLocation | null>;
  structureLoader: DataLoader<string, Structure[]>;
}

@Injectable()
export class GraphQLContextFactory {
  constructor(
    private readonly locationDataLoader: LocationDataLoader,
    private readonly locationGeometryDataLoader: LocationGeometryDataLoader,
    private readonly settlementDataLoader: SettlementDataLoader,
    private readonly structureDataLoader: StructureDataLoader
  ) {}

  /**
   * Create GraphQL context for each request
   * Called by Apollo Server for every GraphQL operation
   */
  createContext({ req, res }: { req: RequestWithUser; res: Response }): GraphQLContext {
    // IMPORTANT: Do NOT read req.user eagerly!
    // Guards run AFTER context creation, so req.user will be undefined here.
    // Instead, we store a reference to req and let decorators read req.user
    // (which will be set by guards before resolvers run).

    // Create fresh DataLoaders for this request
    // Note: We pass undefined for user here since guards haven't run yet.
    // DataLoaders that need user context will re-check when actually used.
    const dataloaders = this.createDataLoaders(undefined);

    // CRITICAL: We CANNOT use a getter because guards run AFTER context creation.
    // The context factory is called by Apollo Server before guards execute,
    // so req.user will be undefined at this point.
    //
    // Solution: Just pass req directly and let decorators read req.user
    // (which will be set by guards before resolvers run).
    const context: GraphQLContext = {
      req,
      res,
      user: req.user, // Will be undefined now, but req will be modified by guards
      dataloaders,
    };

    return context;
  }

  /**
   * Create DataLoaders for this request
   * DataLoaders batch and cache database queries within a single request
   * This prevents N+1 query problems
   * IMPORTANT: DataLoaders include user context for authorization
   */
  private createDataLoaders(user?: AuthenticatedUser): DataLoaders {
    // Each DataLoader should be scoped to a single request to avoid
    // caching data across different users

    // StructureLoader requires user for authorization checks
    // If user is not provided (unauthenticated request like health check),
    // create a dummy loader that throws an error if used. This allows the
    // context to be created for public endpoints while protecting data.
    // Resolvers using structureLoader MUST enforce authentication via guards.
    const structureLoader = user
      ? this.structureDataLoader.createLoader(user)
      : new DataLoader<string, Structure[]>(async () => {
          throw new UnauthorizedException('Authentication required to load structures');
        });

    return {
      locationLoader: this.locationDataLoader.createLoader(),
      locationGeometryLoader: this.locationGeometryDataLoader.createLoader(),
      settlementLoader: this.settlementDataLoader.createLoader(),
      structureLoader,
    };
  }
}
