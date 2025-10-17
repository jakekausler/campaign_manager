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

import { SpatialService } from '../common/services/spatial.service';
import { TileCacheService } from '../common/services/tile-cache.service';
import { DatabaseModule } from '../database/database.module';
import { ExpressionParserService } from '../rules/expression-parser.service';

import { createRedisCache, REDIS_CACHE } from './cache/redis-cache.provider';
import { GraphQLContextFactory, type RequestWithUser } from './context/graphql-context';
import { StructureDataLoader } from './dataloaders/structure.dataloader';
import { createRedisPubSub, REDIS_PUBSUB } from './pubsub/redis-pubsub.provider';
import { CampaignResolver } from './resolvers/campaign.resolver';
import { CharacterResolver } from './resolvers/character.resolver';
import { DependencyGraphResolver } from './resolvers/dependency-graph.resolver';
import { EncounterResolver } from './resolvers/encounter.resolver';
import { EventResolver } from './resolvers/event.resolver';
import { FieldConditionResolver } from './resolvers/field-condition.resolver';
import { HealthResolver } from './resolvers/health.resolver';
import { KingdomResolver } from './resolvers/kingdom.resolver';
import { LinkResolver } from './resolvers/link.resolver';
import { LocationResolver } from './resolvers/location.resolver';
import { PartyResolver } from './resolvers/party.resolver';
import { SettlementResolver } from './resolvers/settlement.resolver';
import { SpatialResolver } from './resolvers/spatial.resolver';
import { StateVariableResolver } from './resolvers/state-variable.resolver';
import { StructureResolver } from './resolvers/structure.resolver';
import { VersionResolver } from './resolvers/version.resolver';
import { WorldTimeResolver } from './resolvers/world-time.resolver';
import { WorldResolver } from './resolvers/world.resolver';
import { DateTimeScalar } from './scalars/datetime.scalar';
import { GeoJSONScalar } from './scalars/geojson.scalar';
import { JSONScalar } from './scalars/json.scalar';
import { UploadScalar } from './scalars/upload.scalar';
import { AuditService } from './services/audit.service';
import { CampaignContextService } from './services/campaign-context.service';
import { CampaignService } from './services/campaign.service';
import { CharacterService } from './services/character.service';
import { ConditionEvaluationService } from './services/condition-evaluation.service';
import { ConditionService } from './services/condition.service';
import { DependencyGraphBuilderService } from './services/dependency-graph-builder.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { EncounterService } from './services/encounter.service';
import { EventService } from './services/event.service';
import { KingdomService } from './services/kingdom.service';
import { LevelHistoryService } from './services/level-history.service';
import { LinkService } from './services/link.service';
import { LocationService } from './services/location.service';
import { PartyService } from './services/party.service';
import { SettlementService } from './services/settlement.service';
import { StateVariableService } from './services/state-variable.service';
import { StructureService } from './services/structure.service';
import { VariableEvaluationService } from './services/variable-evaluation.service';
import { VariableSchemaService } from './services/variable-schema.service';
import { VersionService } from './services/version.service';
import { WorldTimeService } from './services/world-time.service';
import { WorldService } from './services/world.service';
import { DependencyExtractor } from './utils/dependency-extractor';

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
    // Redis PubSub for subscriptions
    {
      provide: REDIS_PUBSUB,
      useFactory: createRedisPubSub,
    },
    // Redis Cache for caching
    {
      provide: REDIS_CACHE,
      useFactory: createRedisCache,
    },
    // Services
    AuditService,
    VersionService,
    WorldService,
    CampaignService,
    CampaignContextService,
    CharacterService,
    PartyService,
    KingdomService,
    SettlementService,
    StructureService,
    LocationService,
    EncounterService,
    EventService,
    LinkService,
    SpatialService,
    TileCacheService,
    LevelHistoryService,
    VariableSchemaService,
    WorldTimeService,
    ExpressionParserService,
    VariableEvaluationService,
    StateVariableService,
    ConditionService,
    ConditionEvaluationService,
    DependencyExtractor,
    DependencyGraphBuilderService,
    DependencyGraphService,
    // DataLoaders
    StructureDataLoader,
    // Resolvers
    HealthResolver,
    VersionResolver,
    WorldResolver,
    CampaignResolver,
    CharacterResolver,
    PartyResolver,
    KingdomResolver,
    SettlementResolver,
    StructureResolver,
    LocationResolver,
    EncounterResolver,
    EventResolver,
    LinkResolver,
    SpatialResolver,
    WorldTimeResolver,
    StateVariableResolver,
    FieldConditionResolver,
    DependencyGraphResolver,
    // Register custom scalars
    DateTimeScalar,
    JSONScalar,
    GeoJSONScalar,
    UploadScalar,
  ],
  exports: [NestGraphQLModule, GraphQLContextFactory],
})
export class GraphQLConfigModule {}
