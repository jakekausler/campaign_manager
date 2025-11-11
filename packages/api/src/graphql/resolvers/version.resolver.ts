/**
 * Version Resolver
 * GraphQL resolvers for Version queries, mutations, and subscriptions
 */

import { Inject, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
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

@SkipThrottle()
@Resolver(() => Version)
export class VersionResolver {
  constructor(
    private readonly versionService: VersionService,
    @Inject(REDIS_PUBSUB) private readonly pubSub: RedisPubSub
  ) {}

  /**
   * Retrieves complete version history for an entity on a specific branch.
   *
   * Returns chronological snapshots of all entity states, enabling
   * time-travel queries, diff comparisons, and audit trails. Each version
   * includes compressed payload that is decompressed for the GraphQL response.
   *
   * **Authorization:** User must have access to the entity's campaign
   *
   * **Performance Notes:**
   * - Versions are stored with gzip-compressed payloads in database
   * - Payloads decompressed on retrieval for GraphQL response
   * - Consider pagination for entities with extensive version histories
   *
   * @param entityType - Type of entity (e.g., 'Settlement', 'Event')
   * @param entityId - Unique identifier of the entity
   * @param branchId - Branch to retrieve version history from
   * @param user - Authenticated user requesting version history
   * @returns Array of versions ordered by validFrom timestamp
   *
   * @see {@link VersionService.findVersionHistory} for query implementation
   * @see docs/features/branching-system.md for versioning concepts
   *
   * @example
   * ```graphql
   * query {
   *   entityVersions(
   *     entityType: "Settlement"
   *     entityId: "settlement-123"
   *     branchId: "main-branch"
   *   ) {
   *     version
   *     validFrom
   *     validTo
   *     userId
   *     payload
   *     comment
   *   }
   * }
   * ```
   */
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

  /**
   * Computes a diff between two entity versions.
   *
   * Compares version payloads and returns field-level changes, useful for
   * review workflows, merge conflict resolution, and understanding entity evolution.
   *
   * **Authorization:** User must have access to the entity's campaign
   *
   * @param versionId1 - ID of first version (typically earlier/base version)
   * @param versionId2 - ID of second version (typically later/target version)
   * @param user - Authenticated user requesting diff
   * @returns Diff object showing added, removed, and modified fields
   *
   * @see {@link VersionService.getVersionDiff} for diff computation logic
   *
   * @example
   * ```graphql
   * query {
   *   versionDiff(
   *     versionId1: "version-abc"
   *     versionId2: "version-def"
   *   ) {
   *     added
   *     removed
   *     modified
   *   }
   * }
   * ```
   */
  @Query(() => VersionDiff, { description: 'Get diff between two versions' })
  @UseGuards(JwtAuthGuard)
  async versionDiff(
    @Args('versionId1', { type: () => ID }) versionId1: string,
    @Args('versionId2', { type: () => ID }) versionId2: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<VersionDiff> {
    return this.versionService.getVersionDiff(versionId1, versionId2, user);
  }

  /**
   * Restores an entity to a previous version state.
   *
   * Creates a new version entry with the payload from the specified historical
   * version, effectively "rolling back" the entity to a prior state while
   * preserving complete version history. This is a non-destructive operation.
   *
   * **Authorization:** User must have write access to the entity
   *
   * **Side Effects:**
   * - Creates new version record with restored payload
   * - Increments entity version number
   * - Updates entity's current state in primary table
   * - Publishes entity modification event for concurrent edit detection
   * - Creates audit log entry
   *
   * @param input - Restore parameters
   * @param input.versionId - ID of version to restore from
   * @param input.branchId - Branch to restore on
   * @param input.worldTime - Optional: World time for the restored version
   * @param input.comment - Optional: Comment explaining the restore
   * @param user - Authenticated user performing the restore
   * @returns Newly created version representing the restored state
   *
   * @see {@link VersionService.restoreVersion} for restore implementation
   * @see docs/features/branching-system.md#version-restoration
   *
   * @example
   * ```graphql
   * mutation {
   *   restoreVersion(input: {
   *     versionId: "version-abc"
   *     branchId: "main-branch"
   *     comment: "Reverting accidental changes"
   *   }) {
   *     version
   *     validFrom
   *     payload
   *     comment
   *   }
   * }
   * ```
   */
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
