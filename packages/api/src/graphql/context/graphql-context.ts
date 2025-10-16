/**
 * GraphQL Context Factory
 * Creates context for each GraphQL request including:
 * - Request/Response objects
 * - Authenticated user from JWT
 * - DataLoaders for N+1 prevention
 */

import { Injectable } from '@nestjs/common';
import type { Structure } from '@prisma/client';
import type DataLoader from 'dataloader';
import type { Request, Response } from 'express';

import { StructureDataLoader } from '../dataloaders/structure.dataloader';

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

// GraphQL Context interface
export interface GraphQLContext {
  req: RequestWithUser;
  res: Response;
  user?: AuthenticatedUser;
  dataloaders: DataLoaders;
}

// DataLoaders interface
export interface DataLoaders {
  structureLoader: DataLoader<string, Structure[]>;
}

@Injectable()
export class GraphQLContextFactory {
  constructor(private readonly structureDataLoader: StructureDataLoader) {}

  /**
   * Create GraphQL context for each request
   * Called by Apollo Server for every GraphQL operation
   */
  createContext({ req, res }: { req: RequestWithUser; res: Response }): GraphQLContext {
    // User will be injected by JwtAuthGuard if authenticated
    const user = req.user;

    // Create fresh DataLoaders for this request
    // DataLoaders require user context for authorization
    const dataloaders = this.createDataLoaders(user);

    return {
      req,
      res,
      user,
      dataloaders,
    };
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
    // User is required for authorization checks in DataLoaders
    if (!user) {
      // If no user, create empty DataLoaders that will fail authorization
      // This ensures unauthenticated requests can't access data
      throw new Error('User context required for DataLoaders');
    }

    return {
      structureLoader: this.structureDataLoader.createLoader(user),
    };
  }
}
