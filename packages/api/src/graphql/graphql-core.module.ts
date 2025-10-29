/**
 * GraphQL Core Module
 * Provides core GraphQL infrastructure (context factory, dataloaders, services)
 * Separate from graphql.module.ts to avoid circular dependency issues
 */

import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SpatialService } from '../common/services/spatial.service';
import { TileCacheService } from '../common/services/tile-cache.service';
import { DatabaseModule } from '../database/database.module';
import { GrpcModule } from '../grpc/grpc.module';
import { RulesModule } from '../rules/rules.module';

import { createRedisCache, REDIS_CACHE } from './cache/redis-cache.provider';
import { GraphQLContextFactory } from './context/graphql-context';
import { LocationGeometryDataLoader } from './dataloaders/location-geometry.dataloader';
import { LocationDataLoader } from './dataloaders/location.dataloader';
import { SettlementDataLoader } from './dataloaders/settlement.dataloader';
import { StructureDataLoader } from './dataloaders/structure.dataloader';
import { createRedisPubSub, REDIS_PUBSUB } from './pubsub/redis-pubsub.provider';
import { AuditService } from './services/audit.service';
import { BranchService } from './services/branch.service';
import { CampaignContextService } from './services/campaign-context.service';
import { CampaignService } from './services/campaign.service';
import { CharacterService } from './services/character.service';
import { ConditionEvaluationService } from './services/condition-evaluation.service';
import { ConditionService } from './services/condition.service';
import { DependencyGraphBuilderService } from './services/dependency-graph-builder.service';
import { DependencyGraphService } from './services/dependency-graph.service';
import { EffectExecutionService } from './services/effect-execution.service';
import { EffectPatchService } from './services/effect-patch.service';
import { EffectService } from './services/effect.service';
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
  imports: [DatabaseModule, GrpcModule, RulesModule, AuthModule],
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
    BranchService,
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
    VariableEvaluationService,
    StateVariableService,
    ConditionService,
    ConditionEvaluationService,
    DependencyExtractor,
    DependencyGraphBuilderService,
    DependencyGraphService,
    EffectPatchService,
    EffectExecutionService,
    EffectService,
    // DataLoaders
    LocationDataLoader,
    LocationGeometryDataLoader,
    SettlementDataLoader,
    StructureDataLoader,
  ],
  exports: [
    // Context factory
    GraphQLContextFactory,
    // Redis providers
    REDIS_PUBSUB,
    REDIS_CACHE,
    // Export all services for use by resolvers in GraphQLConfigModule
    AuditService,
    BranchService,
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
    VariableEvaluationService,
    StateVariableService,
    ConditionService,
    ConditionEvaluationService,
    DependencyExtractor,
    DependencyGraphBuilderService,
    DependencyGraphService,
    EffectPatchService,
    EffectExecutionService,
    EffectService,
    // Export all DataLoaders for use by resolvers
    LocationDataLoader,
    LocationGeometryDataLoader,
    SettlementDataLoader,
    StructureDataLoader,
  ],
})
export class GraphQLCoreModule {}
