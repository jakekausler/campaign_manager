/**
 * EffectExecutionService
 *
 * Orchestrates effect execution with support for:
 * - Single effect execution with patch application
 * - Multi-effect execution sorted by priority
 * - Dependency-ordered execution using topological sort
 * - Circular dependency detection via DependencyGraphService
 * - Comprehensive audit trail via EffectExecution records
 * - Dry-run mode for preview without side effects
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  NotImplementedException,
} from '@nestjs/common';
import type {
  Effect,
  EffectExecution,
  EffectTiming,
  Encounter,
  Event,
  Settlement,
  Structure,
  Prisma,
} from '@prisma/client';
import type { Operation } from 'fast-json-patch';

import { PrismaService } from '../../database/prisma.service';

import { EffectPatchService, type PatchableEntityType } from './effect-patch.service';

/**
 * User context for authorization and audit
 */
export interface UserContext {
  id: string;
  email: string;
  campaigns?: Array<{ campaignId: string; role: string }>;
}

/**
 * Result of single effect execution
 */
export interface EffectExecutionResult {
  success: boolean;
  effectId: string;
  executionId: string | null;
  patchApplied: unknown | null;
  error: string | null;
}

/**
 * Summary of multi-effect execution
 */
export interface EffectExecutionSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: EffectExecutionResult[];
  executionOrder: string[]; // Array of effect IDs in execution order
}

/**
 * Summary of dependency-ordered execution
 */
export interface DependencyExecutionSummary extends EffectExecutionSummary {
  dependencyOrder: string[]; // Array of effect IDs in topological order
}

/**
 * Supported entity types that can be targeted by effects
 */
type EntityType = 'ENCOUNTER' | 'EVENT' | 'SETTLEMENT' | 'STRUCTURE';

/**
 * Union type of all patchable entities
 */
type PatchableEntity = Encounter | Event | Settlement | Structure;

@Injectable()
export class EffectExecutionService {
  private readonly logger = new Logger(EffectExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly effectPatchService: EffectPatchService
  ) {}

  /**
   * Execute a single effect with patch application and audit logging
   *
   * @param effectId - ID of effect to execute
   * @param context - Optional entity context (will load if not provided)
   * @param user - User context for authorization and audit
   * @param dryRun - If true, preview changes without persisting
   * @returns Execution result with success status and audit ID
   */
  async executeEffect(
    effectId: string,
    context: unknown | undefined,
    user: UserContext,
    dryRun: boolean
  ): Promise<EffectExecutionResult> {
    this.logger.log(`Executing effect ${effectId} (dryRun: ${dryRun})`);

    try {
      // Load effect
      const effect = await this.prisma.effect.findUnique({
        where: { id: effectId, deletedAt: null },
      });

      if (!effect) {
        throw new NotFoundException(`Effect ${effectId} not found`);
      }

      if (!effect.isActive) {
        throw new ForbiddenException(`Effect ${effectId} is not active`);
      }

      // Load or use provided context
      const entity =
        context ?? (await this.loadEntity(effect.entityType as EntityType, effect.entityId));

      if (!entity) {
        throw new NotFoundException(`Entity ${effect.entityType}:${effect.entityId} not found`);
      }

      // Delegate to internal execution method
      return await this.executeEffectInternal(effect, entity, user, dryRun, false);
    } catch (error) {
      this.logger.error(`Error executing effect ${effectId}:`, error);
      throw error;
    }
  }

  /**
   * Internal method to execute an already-loaded effect
   * Used by both executeEffect and executeEffectsForEntity
   *
   * @param effect - Already-loaded effect object
   * @param entity - Entity context
   * @param user - User context
   * @param dryRun - Preview mode flag
   * @param skipEntityUpdate - If true, create execution record but don't update entity (for resolve/complete workflows)
   * @returns Execution result
   */
  private async executeEffectInternal(
    effect: Effect,
    entity: unknown,
    user: UserContext,
    dryRun: boolean,
    skipEntityUpdate = false
  ): Promise<EffectExecutionResult> {
    const effectId = effect.id;

    // Apply patch
    const patchResult = this.effectPatchService.applyPatch(
      entity,
      effect.payload as never, // Type assertion for Operation[]
      this.mapToPatchableEntityType(effect.entityType as EntityType)
    );

    if (!patchResult.success) {
      const errorMessage = patchResult.errors.join('; ');
      this.logger.warn(`Effect ${effectId} patch failed: ${errorMessage}`);

      if (!dryRun) {
        await this.createAuditRecord(
          effect,
          entity,
          { success: false, patchApplied: null },
          user.id,
          errorMessage
        );
      }

      return {
        success: false,
        effectId,
        executionId: null,
        patchApplied: null,
        error: errorMessage,
      };
    }

    // In dry-run mode, return preview without persisting
    if (dryRun) {
      this.logger.log(`Effect ${effectId} dry-run successful`);
      return {
        success: true,
        effectId,
        executionId: null,
        patchApplied: effect.payload,
        error: null,
      };
    }

    // Persist changes and create audit record in transaction
    const execution = await this.prisma.$transaction(async (tx) => {
      // Update entity with patched data (unless skipEntityUpdate is true)
      if (!skipEntityUpdate) {
        await this.updateEntity(
          effect.entityType as EntityType,
          effect.entityId,
          patchResult.patchedEntity as PatchableEntity,
          tx
        );
      }

      // Create audit record
      return await tx.effectExecution.create({
        data: {
          effectId: effect.id,
          entityType: effect.entityType,
          entityId: effect.entityId,
          executedBy: user.id,
          context: entity as never, // Snapshot before execution
          result: {
            success: true,
            patchApplied: effect.payload,
            affectedFields: this.extractAffectedFields(effect.payload as never),
          },
          error: null,
        },
      });
    });

    this.logger.log(`Effect ${effectId} executed successfully (execution: ${execution.id})`);

    return {
      success: true,
      effectId,
      executionId: execution.id,
      patchApplied: effect.payload,
      error: null,
    };
  }

  /**
   * Execute all active effects for an entity at a specific timing phase
   *
   * Effects are executed in priority order (ascending) within the timing phase.
   * Failed effects are logged but don't prevent other effects from executing.
   *
   * @param entityType - Type of entity (ENCOUNTER or EVENT)
   * @param entityId - ID of entity
   * @param timing - Timing phase (PRE, ON_RESOLVE, POST)
   * @param user - User context for authorization and audit
   * @param skipEntityUpdate - If true, create execution records but don't update entity (for resolve/complete workflows)
   * @returns Summary of execution results
   */
  async executeEffectsForEntity(
    entityType: EntityType,
    entityId: string,
    timing: string,
    user: UserContext,
    skipEntityUpdate = false
  ): Promise<EffectExecutionSummary> {
    this.logger.log(`Executing ${timing} effects for ${entityType}:${entityId}`);

    // Query active effects for this entity and timing, sorted by priority
    const effectsFromDb = await this.prisma.effect.findMany({
      where: {
        entityType,
        entityId,
        timing: timing as EffectTiming,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { priority: 'asc' },
    });

    if (effectsFromDb.length === 0) {
      this.logger.log(`No active effects found for ${entityType}:${entityId} at timing ${timing}`);
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: [],
        executionOrder: [],
      };
    }

    // Sort effects by priority (defensive, should already be sorted by DB)
    const effects = [...effectsFromDb].sort((a, b) => a.priority - b.priority);

    // Load entity context once (will be reused for all effects)
    const entity = await this.loadEntity(entityType, entityId);

    if (!entity) {
      throw new NotFoundException(`Entity ${entityType}:${entityId} not found`);
    }

    // Execute effects sequentially in priority order
    const results: EffectExecutionResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const effect of effects) {
      try {
        // Check if effect is active (should be filtered by query, but double-check)
        if (!effect.isActive) {
          throw new ForbiddenException(`Effect ${effect.id} is not active`);
        }

        const result = await this.executeEffectInternal(
          effect,
          entity,
          user,
          false,
          skipEntityUpdate
        );
        results.push(result);

        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        // Log error but continue with other effects
        this.logger.error(`Effect ${effect.id} execution failed:`, error);
        failed++;
        results.push({
          success: false,
          effectId: effect.id,
          executionId: null,
          patchApplied: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    this.logger.log(
      `Executed ${effects.length} effects for ${entityType}:${entityId}: ${succeeded} succeeded, ${failed} failed`
    );

    return {
      total: effects.length,
      succeeded,
      failed,
      results,
      executionOrder: effects.map((e: Effect) => e.id),
    };
  }

  /**
   * Execute multiple effects in dependency order using topological sort
   *
   * **NOT YET IMPLEMENTED**: This method requires GraphQL resolver integration
   * to be completed in Stage 6 (TICKET-016). It needs:
   * - Campaign ID extraction from effect entities
   * - Branch ID support for world-state time travel
   * - Effect-level dependency tracking (currently only tracks conditions/variables)
   *
   * @param _effectIds - Array of effect IDs to execute (unused)
   * @param _context - Entity context to use for all effects (unused)
   * @param _user - User context for authorization and audit (unused)
   * @returns Never (always throws NotImplementedException)
   * @throws NotImplementedException - Always thrown until Stage 7 dependency graph integration
   */
  async executeEffectsWithDependencies(
    _effectIds: string[],
    _context: unknown,
    _user: UserContext
  ): Promise<DependencyExecutionSummary> {
    throw new NotImplementedException(
      'Effect dependency-ordered execution is not yet implemented. ' +
        'This feature requires Stage 7 (Dependency Graph Integration) to be completed. ' +
        'Use executeEffectsForEntity() for priority-based execution instead.'
    );
  }

  /**
   * Load entity from database by type and ID
   *
   * @param entityType - Type of entity (ENCOUNTER, EVENT, SETTLEMENT, or STRUCTURE)
   * @param entityId - ID of entity
   * @returns Entity object or null if not found
   */
  private async loadEntity(
    entityType: EntityType,
    entityId: string
  ): Promise<PatchableEntity | null> {
    switch (entityType) {
      case 'ENCOUNTER':
        return await this.prisma.encounter.findUnique({
          where: { id: entityId, deletedAt: null },
        });
      case 'EVENT':
        return await this.prisma.event.findUnique({
          where: { id: entityId, deletedAt: null },
        });
      case 'SETTLEMENT':
        return await this.prisma.settlement.findUnique({
          where: { id: entityId, deletedAt: null },
        });
      case 'STRUCTURE':
        return await this.prisma.structure.findUnique({
          where: { id: entityId, deletedAt: null },
        });
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Update entity in database with patched data
   *
   * @param entityType - Type of entity (ENCOUNTER, EVENT, SETTLEMENT, or STRUCTURE)
   * @param entityId - ID of entity
   * @param patchedEntity - Patched entity data
   * @param tx - Prisma transaction client
   */
  private async updateEntity(
    entityType: EntityType,
    entityId: string,
    patchedEntity: PatchableEntity,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    switch (entityType) {
      case 'ENCOUNTER':
        await tx.encounter.update({
          where: { id: entityId },
          data: patchedEntity as Prisma.EncounterUpdateInput,
        });
        break;
      case 'EVENT':
        await tx.event.update({
          where: { id: entityId },
          data: patchedEntity as Prisma.EventUpdateInput,
        });
        break;
      case 'SETTLEMENT':
        await tx.settlement.update({
          where: { id: entityId },
          data: patchedEntity as Prisma.SettlementUpdateInput,
        });
        break;
      case 'STRUCTURE':
        await tx.structure.update({
          where: { id: entityId },
          data: patchedEntity as Prisma.StructureUpdateInput,
        });
        break;
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  /**
   * Create audit record for effect execution
   *
   * @param effect - Effect that was executed
   * @param entity - Entity context before execution
   * @param result - Execution result
   * @param userId - User who triggered execution
   * @param error - Optional error message
   * @returns Created EffectExecution record
   */
  private async createAuditRecord(
    effect: Effect,
    entity: unknown,
    result: { success: boolean; patchApplied: unknown | null },
    userId: string,
    error: string | null = null
  ): Promise<EffectExecution> {
    return await this.prisma.effectExecution.create({
      data: {
        effectId: effect.id,
        entityType: effect.entityType,
        entityId: effect.entityId,
        executedBy: userId,
        context: entity as never,
        result: result as never,
        error,
      },
    });
  }

  /**
   * Extract affected field paths from patch operations
   *
   * @param operations - JSON Patch operations array
   * @returns Array of affected field paths
   */
  private extractAffectedFields(operations: Operation[]): string[] {
    // Extract paths from patch operations
    const fields = new Set<string>();

    if (!Array.isArray(operations)) {
      return [];
    }

    for (const operation of operations) {
      if (operation.path) {
        fields.add(operation.path);
      }
      // For copy/move operations, also track the 'from' path
      if ('from' in operation && operation.from) {
        fields.add(operation.from as string);
      }
    }

    return Array.from(fields);
  }

  /**
   * Map entity type to patchable entity type
   *
   * @param entityType - Entity type from effect
   * @returns Patchable entity type for EffectPatchService
   */
  private mapToPatchableEntityType(entityType: EntityType): PatchableEntityType {
    return entityType as PatchableEntityType;
  }
}
