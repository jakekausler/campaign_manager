/**
 * @fileoverview Combined JWT or API Key Authentication Guard
 *
 * This guard implements OR logic for authentication: tries JWT first, then API key.
 * This allows the same endpoint to be accessed by:
 * - Web clients using JWT tokens (Authorization: Bearer <jwt>)
 * - Service accounts using API keys (x-api-key: <key>)
 *
 * Without this combined guard, NestJS would execute guards with AND logic,
 * meaning BOTH would need to succeed. This guard calls Passport strategies
 * directly to implement proper OR logic.
 *
 * @module auth/guards/jwt-or-api-key-auth
 */

import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ApiKeyStrategy } from '../strategies/api-key.strategy';
import { JwtStrategy } from '../strategies/jwt.strategy';

/**
 * Combined guard that tries JWT authentication first, then API key authentication
 *
 * Implements OR logic for multi-strategy authentication by calling Passport strategies
 * directly instead of using guards (which don't compose well via dependency injection).
 *
 * **Authentication Flow:**
 * 1. Extract and verify JWT token from Authorization header
 * 2. If JWT is valid → call JwtStrategy.validate() → return true
 * 3. If JWT fails → extract API key from x-api-key header
 * 4. If API key present → call ApiKeyStrategy.validate() → return true
 * 5. If both fail → throw UnauthorizedException
 *
 * **Use Cases:**
 * - GraphQL queries/mutations that can be accessed by both web clients and service accounts
 * - Scheduler service using API keys while web clients use JWT
 * - CI/CD pipelines using API keys for automated testing
 *
 * @example
 * ```typescript
 * @Query(() => [Campaign])
 * @UseGuards(JwtOrApiKeyAuthGuard)
 * async campaigns(@CurrentUser() user: AuthenticatedUser) {
 *   // Can be accessed with either JWT or API key
 * }
 * ```
 */
@Injectable()
export class JwtOrApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtStrategy: JwtStrategy,
    private readonly apiKeyStrategy: ApiKeyStrategy,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Attempt authentication using JWT first, then API key as fallback
   *
   * @param context - Execution context (HTTP or GraphQL)
   * @returns True if either JWT or API key authentication succeeds
   * @throws UnauthorizedException if both authentication methods fail
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = this.getRequest(context);

    // Try JWT authentication first
    try {
      const authHeader = request.headers?.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);

        // Verify and decode the JWT token
        const payload = this.jwtService.verify<JwtPayload>(token);

        // Call the JWT strategy's validate method with the decoded payload
        const user = await this.jwtStrategy.validate(payload);

        if (user) {
          // Attach user to request for downstream use
          request.user = user;
          return true;
        }
      }
    } catch (jwtError) {
      // JWT failed or not present, try API key authentication
    }

    // Try API key authentication as fallback
    try {
      const apiKey = request.headers?.['x-api-key'];

      if (apiKey) {
        // Call the API key strategy's validate method with the request
        const user = await this.apiKeyStrategy.validate(request);

        if (user) {
          // Attach user to request for downstream use
          request.user = user;
          return true;
        }
      }
    } catch (apiKeyError) {
      // API key authentication failed
    }

    // Both authentication methods failed
    throw new UnauthorizedException('Invalid credentials');
  }

  /**
   * Extract the underlying HTTP request from execution context
   *
   * Handles both regular HTTP requests and GraphQL requests (which wrap the HTTP request)
   *
   * @param context - Execution context
   * @returns The HTTP request object
   */
  private getRequest(context: ExecutionContext): any {
    // Check if this is a GraphQL context
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext();

    // GraphQL context has the request in ctx.req
    if (ctx.req) {
      return ctx.req;
    }

    // Fall back to HTTP context
    return context.switchToHttp().getRequest();
  }
}
