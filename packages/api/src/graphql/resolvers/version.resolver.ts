/**
 * Version Resolver
 * GraphQL resolvers for Version queries, mutations, and subscriptions
 */

import { Inject, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import type { RedisPubSub } from 'graphql-redis-subscriptions';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../context/graphql-context';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RestoreVersionInput } from '../inputs/version.input';
import { REDIS_PUBSUB } from '../pubsub/redis-pubsub.provider';
import { VersionService } from '../services/version.service';
import type { EntityModified as EntityModifiedType } from '../types/version.type';
import { EntityModified, Version, VersionDiff } from '../types/version.type';
import { decompressPayload } from '../utils/version.utils';

@Resolver(() => Version)
export class VersionResolver {
  constructor(
    private readonly versionService: VersionService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  @Query(() => [Version], { description: 'Get version history for an entity' })
  @UseGuards(JwtAuthGuard)
  async entityVersions(
    @Args('entityType') entityType: string,
    @Args('entityId', { type: () => ID }) entityId: string,
    @Args('branchId', { type: () => ID }) branchId: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Version[]> {
    const versions = await this.versionService.findVersionHistory(
      entityType,
      entityId,
      branchId,
      user
    );

    // Decompress payloads for GraphQL response
    return Promise.all(
      versions.map(async (version) => ({
        ...version,
        validTo: version.validTo ?? undefined,
        comment: version.comment ?? undefined,
        payload: await decompressPayload(Buffer.from(version.payloadGz)),
      }))
    );
  }

  @Query(() => VersionDiff, { description: 'Get diff between two versions' })
  @UseGuards(JwtAuthGuard)
  async versionDiff(
    @Args('versionId1', { type: () => ID }) versionId1: string,
    @Args('versionId2', { type: () => ID }) versionId2: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VersionDiff> {
    return this.versionService.getVersionDiff(versionId1, versionId2, user);
  }

  @Mutation(() => Version, { description: 'Restore entity to a previous version' })
  @UseGuards(JwtAuthGuard)
  async restoreVersion(
    @Args('input') input: RestoreVersionInput,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<Version> {
    const version = await this.versionService.restoreVersion(
      input.versionId,
      input.branchId,
      user,
      input.worldTime,
      input.comment
    );

    // Decompress payload for GraphQL response
    return {
      ...version,
      validTo: version.validTo ?? undefined,
      comment: version.comment ?? undefined,
      payload: await decompressPayload(Buffer.from(version.payloadGz)),
    };
  }

  @Subscription(() => EntityModified, {
    description: 'Subscribe to entity modification events for concurrent edit detection',
  })
  entityModified(@Args('entityId', { type: () => ID }) entityId: string) {
    return this.pubSub.asyncIterator<{ entityModified: EntityModifiedType }>(
      `entity.modified.${entityId}`
    );
  }
}
