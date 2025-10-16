/**
 * GraphQL Module Configuration
 * Sets up Apollo Server with NestJS integration, code-first approach
 */

import { join } from 'path';

import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import type { Response } from 'express';
import type { DocumentNode, GraphQLSchema } from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';

import { DatabaseModule } from '../database/database.module';

import { GraphQLContextFactory, type RequestWithUser } from './context/graphql-context';
import { StructureDataLoader } from './dataloaders/structure.dataloader';
import { HealthResolver } from './resolvers/health.resolver';
import { SettlementResolver } from './resolvers/settlement.resolver';
import { StructureResolver } from './resolvers/structure.resolver';
import { DateTimeScalar } from './scalars/datetime.scalar';
import { GeoJSONScalar } from './scalars/geojson.scalar';
import { JSONScalar } from './scalars/json.scalar';
import { UploadScalar } from './scalars/upload.scalar';
import { SettlementService } from './services/settlement.service';
import { StructureService } from './services/structure.service';

@Module({
  imports: [
    DatabaseModule, // For PrismaService in context factory
    NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [DatabaseModule],
      useFactory: (contextFactory: GraphQLContextFactory) => ({
        // Code-first approach - generate schema from TypeScript classes
        autoSchemaFile: join(process.cwd(), 'packages/api/src/schema.gql'),
        sortSchema: true,
        // Enable GraphQL Playground in development
        playground: false, // Use Apollo Sandbox instead
        plugins: [
          ...(process.env.NODE_ENV === 'production'
            ? []
            : [ApolloServerPluginLandingPageLocalDefault()]),
          // Query complexity plugin
          {
            async requestDidStart() {
              return {
                async didResolveOperation({
                  request,
                  document,
                }: {
                  request: { schema?: GraphQLSchema; variables?: Record<string, unknown> };
                  document: DocumentNode;
                }) {
                  if (!request.schema) {
                    return;
                  }
                  const complexity = getComplexity({
                    schema: request.schema,
                    query: document,
                    variables: request.variables,
                    estimators: [
                      fieldExtensionsEstimator(),
                      simpleEstimator({ defaultComplexity: 1 }),
                    ],
                  });

                  const maxComplexity = 1000;
                  if (complexity > maxComplexity) {
                    throw new Error(
                      `Query is too complex: ${complexity}. Maximum allowed complexity: ${maxComplexity}`
                    );
                  }
                },
              };
            },
          },
        ],
        // Context setup with authentication and DataLoader
        context: ({ req, res }: { req: RequestWithUser; res: Response }) =>
          contextFactory.createContext({ req, res }),
        // Enable introspection in all environments (can be disabled in production later)
        introspection: true,
        // Format errors for consistent error responses
        formatError: (formattedError, _error) => {
          const { message, extensions } = formattedError;
          return {
            message,
            ...(process.env.NODE_ENV !== 'production' && {
              extensions,
            }),
          };
        },
        // Enable persisted queries for production optimization
        persistedQueries: process.env.NODE_ENV === 'production' ? {} : false,
        // CORS configuration (will be handled by main.ts)
        cors: false,
        // Subscription configuration
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': false, // Deprecated protocol
        },
      }),
      inject: [GraphQLContextFactory],
    }),
  ],
  providers: [
    // Context factory
    GraphQLContextFactory,
    // Services
    SettlementService,
    StructureService,
    // DataLoaders
    StructureDataLoader,
    // Resolvers
    HealthResolver,
    SettlementResolver,
    StructureResolver,
    // Register custom scalars
    DateTimeScalar,
    JSONScalar,
    GeoJSONScalar,
    UploadScalar,
  ],
  exports: [NestGraphQLModule, GraphQLContextFactory],
})
export class GraphQLConfigModule {}
