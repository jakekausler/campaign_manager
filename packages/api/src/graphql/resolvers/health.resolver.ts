/**
 * Health Check Resolver
 * Provides basic health check query for GraphQL endpoint testing
 */

import { Query, Resolver, ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class HealthCheck {
  @Field()
  status!: string;

  @Field()
  timestamp!: Date;

  @Field({ nullable: true })
  version?: string;
}

@Resolver()
export class HealthResolver {
  /**
   * Health check endpoint for monitoring and testing.
   *
   * Returns a simple status object indicating the GraphQL API is responsive.
   * This query requires no authentication and can be used by load balancers,
   * monitoring tools, and integration tests.
   *
   * @returns Health check object with status, timestamp, and version
   *
   * @example
   * ```graphql
   * query {
   *   health {
   *     status
   *     timestamp
   *     version
   *   }
   * }
   * ```
   */
  @Query(() => HealthCheck, {
    description: 'Health check query to verify GraphQL endpoint is working',
  })
  health(): HealthCheck {
    return {
      status: 'ok',
      timestamp: new Date(),
      version: process.env.npm_package_version || '0.1.0',
    };
  }
}
