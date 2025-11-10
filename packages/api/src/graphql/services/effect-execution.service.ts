/**
 * @fileoverview Effect Execution Service
 *
 * Orchestrates the execution of effect operations, applying JSON Patch operations
 * to world entities with comprehensive audit logging, dry-run preview mode, and
 * support for 3-phase timing execution (PRE/ON_RESOLVE/POST).
 *
 * Key Responsibilities:
 * - Single effect execution with JSON Patch application
 * - Multi-effect batch execution sorted by priority within timing phases
 * - Entity state mutation with transactional consistency
 * - Comprehensive audit trail via EffectExecution records
 * - Dry-run preview mode for simulation without side effects
 * - Skip-update mode for resolve/complete workflows (audit only)
 *
 * Effect Execution Model:
 * - Effects contain JSON Patch operations targeting world entities
 * - Execution follows 3-phase timing: PRE → ON_RESOLVE → POST
 * - Within each phase, effects execute in priority order (ascending)
 * - Failed effects are logged but don't block other effects
 * - All executions create audit records with before/after snapshots
 *
 * @see {@link EffectPatchService} For JSON Patch application logic
 * @see {@link docs/features/effect-system.md} For comprehensive effect system documentation
 * @module services/effect-execution
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
 * User context for authorization and audit logging.
 *
 * Provides user identity and campaign access information for effect executions.
 * Stored in EffectExecution records to track who triggered each execution.
 *
 * @interface UserContext
 * @property {string} id - User's unique identifier (stored in executedBy field)
 * @property {string} email - User's email address (for logging and audit reports)
 * @property {Array<{campaignId: string; role: string}>} [campaigns] - User's campaign access list (future: for authorization checks)
 */
export interface UserContext {
  id: string;
  email: string;
  campaigns?: Array<{ campaignId: string; role: string }>;
}

/**
 * Result of a single effect execution operation.
 *
 * Contains execution status, audit trail reference, and error details if failed.
 * Used by both single-effect and batch execution methods.
 *
 * @interface EffectExecutionResult
 * @property {boolean} success - Whether patch application succeeded
 * @property {string} effectId - ID of the effect that was executed
 * @property {string | null} executionId - ID of EffectExecution audit record (null in dry-run or failure)
 * @property {unknown | null} patchApplied - The JSON Patch operations that were applied (null if failed)
 * @property {string | null} error - Error message if execution failed (null if successful)
 *
 * @example
 * // Successful execution
 * {
 *   success: true,
 *   effectId: "effect-123",
 *   executionId: "exec-456",
 *   patchApplied: [{ op: "replace", path: "/status", value: "RESOLVED" }],
 *   error: null
 * }
 *
 * @example
 * // Failed execution
 * {
 *   success: false,
 *   effectId: "effect-789",
 *   executionId: null,
 *   patchApplied: null,
 *   error: "Invalid patch path: /nonexistent/field"
 * }
 */
export interface EffectExecutionResult {
  success: boolean;
  effectId: string;
  executionId: string | null;
  patchApplied: unknown | null;
  error: string | null;
}

/**
 * Summary of multi-effect batch execution operation.
 *
 * Aggregates results from executing multiple effects in priority order.
 * Used by executeEffectsForEntity() to track batch execution outcomes.
 *
 * @interface EffectExecutionSummary
 * @property {number} total - Total number of effects attempted
 * @property {number} succeeded - Number of effects that succeeded
 * @property {number} failed - Number of effects that failed (execution continues despite failures)
 * @property {EffectExecutionResult[]} results - Individual result for each effect execution
 * @property {string[]} executionOrder - Array of effect IDs in the order they were executed (priority ascending)
 *
 * @example
 * // Batch execution with mixed results
 * {
 *   total: 3,
 *   succeeded: 2,
 *   failed: 1,
 *   results: [
 *     { success: true, effectId: "effect-1", ... },
 *     { success: false, effectId: "effect-2", ... },
 *     { success: true, effectId: "effect-3", ... }
 *   ],
 *   executionOrder: ["effect-1", "effect-2", "effect-3"]
 * }
 */
export interface EffectExecutionSummary {
  total: number;
  succeeded: number;
  failed: number;
  results: EffectExecutionResult[];
  executionOrder: string[]; // Array of effect IDs in execution order
}

/**
 * Summary of dependency-ordered execution (NOT YET IMPLEMENTED).
 *
 * Extends EffectExecutionSummary with topological dependency ordering.
 * This feature requires Stage 7 (Dependency Graph Integration) to be completed.
 *
 * @interface DependencyExecutionSummary
 * @extends {EffectExecutionSummary}
 * @property {string[]} dependencyOrder - Array of effect IDs in topological dependency order
 *
 * @see {@link executeEffectsWithDependencies} Method that will use this interface (not yet implemented)
 */
export interface DependencyExecutionSummary extends EffectExecutionSummary {
  dependencyOrder: string[]; // Array of effect IDs in topological order
}

/**
 * Supported entity types that can be targeted by effects.
 *
 * Effects can mutate these world entities by applying JSON Patch operations.
 * Corresponds to EntityType enum in Prisma schema.
 *
 * @typedef {('ENCOUNTER' | 'EVENT' | 'SETTLEMENT' | 'STRUCTURE')} EntityType
 */
type EntityType = 'ENCOUNTER' | 'EVENT' | 'SETTLEMENT' | 'STRUCTURE';

/**
 * Union type of all patchable Prisma entities.
 *
 * Represents the entities that can be loaded, patched, and persisted by this service.
 * Each type corresponds to a Prisma model with JSON Patch support.
 *
 * @typedef {(Encounter | Event | Settlement | Structure)} PatchableEntity
 */
type PatchableEntity = Encounter | Event | Settlement | Structure;

/**
 * Service for executing effects and applying JSON Patch operations to world entities.
 *
 * Core Operations:
 * - Single effect execution with validation, patch application, and audit logging
 * - Batch execution of all effects for an entity at a specific timing phase
 * - Dry-run preview mode for simulation without persistence
 * - Skip-update mode for audit-only execution during resolve workflows
 *
 * Execution Flow:
 * 1. Load effect and validate (active status, entity existence)
 * 2. Load target entity from database
 * 3. Apply JSON Patch operations using EffectPatchService
 * 4. Persist entity changes (unless dry-run or skip-update)
 * 5. Create EffectExecution audit record
 * 6. Return result with success status and execution ID
 *
 * 3-Phase Execution Model:
 * - PRE: Effects that run before resolution (e.g., pre-conditions, setup)
 * - ON_RESOLVE: Effects that run during resolution (e.g., state changes)
 * - POST: Effects that run after resolution (e.g., cleanup, notifications)
 *
 * Error Handling:
 * - Validation errors (NotFound, Forbidden, BadRequest) are thrown immediately
 * - Patch application errors are caught and logged as failed executions
 * - In batch execution, failed effects don't block other effects
 * - All errors create audit records (except in dry-run mode)
 *
 * Transaction Guarantees:
 * - Entity update and audit record creation occur in a single transaction
 * - Ensures consistency between world state and audit trail
 * - Rollback on any failure maintains data integrity
 *
 * @class EffectExecutionService
 * @see {@link EffectPatchService} For JSON Patch application logic
 * @see {@link docs/features/effect-system.md} For comprehensive effect system documentation
 */
@Injectable()
export class EffectExecutionService {
  private readonly logger = new Logger(EffectExecutionService.name);

  /**
   * Creates an instance of EffectExecutionService.
   *
   * @param {PrismaService} prisma - Database client for entity and audit operations
   * @param {EffectPatchService} effectPatchService - Service for applying JSON Patch operations
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly effectPatchService: EffectPatchService
  ) {}

  /**
   * Execute a single effect with patch application and audit logging.
   *
   * Primary entry point for executing individual effects. Loads the effect,
   * validates status and entity existence, applies JSON Patch operations,
   * and persists changes with audit logging.
   *
   * Execution Steps:
   * 1. Load effect from database and validate (exists, active, entity exists)
   * 2. Load entity context (use provided or fetch from database)
   * 3. Delegate to executeEffectInternal for patch application
   * 4. Return result with execution ID for audit trail lookup
   *
   * Dry-Run Mode:
   * - When dryRun=true, applies patch but doesn't persist changes
   * - Returns preview of patched state without creating audit record
   * - Useful for "what-if" simulations and validation
   *
   * @param {string} effectId - Unique identifier of effect to execute
   * @param {unknown} [context] - Optional pre-loaded entity context (if not provided, loads from database)
   * @param {UserContext} user - User context for authorization and audit trail
   * @param {boolean} dryRun - Whether to preview changes without persisting (default: false)
   * @returns {Promise<EffectExecutionResult>} Execution result with success status, execution ID, and applied patch
   * @throws {NotFoundException} If effect or entity not found
   * @throws {ForbiddenException} If effect is not active
   *
   * @example
   * // Execute effect with dry-run preview
   * const result = await service.executeEffect(
   *   'effect-123',
   *   undefined,
   *   { id: 'user-1', email: 'user@example.com' },
   *   true
   * );
   * console.log('Dry-run result:', result.patchApplied);
   *
   * @example
   * // Execute effect with actual persistence
   * const result = await service.executeEffect(
   *   'effect-123',
   *   encounterEntity, // Pre-loaded context
   *   { id: 'user-1', email: 'user@example.com' },
   *   false
   * );
   * console.log('Execution ID:', result.executionId);
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
   * Internal method to execute an already-loaded effect.
   *
   * Core implementation shared by executeEffect() and executeEffectsForEntity().
   * Assumes effect and entity are already loaded and validated.
   *
   * Operation Modes:
   * 1. Normal mode (skipEntityUpdate=false, dryRun=false):
   *    - Apply patch, update entity, create audit record
   * 2. Dry-run mode (dryRun=true):
   *    - Apply patch, return preview without persistence
   * 3. Audit-only mode (skipEntityUpdate=true, dryRun=false):
   *    - Apply patch, create audit record, but don't update entity
   *    - Used in resolve/complete workflows where entity is updated separately
   *
   * Transaction Behavior:
   * - Entity update and audit record creation happen atomically
   * - Rollback on any failure ensures consistency
   * - Skip-update mode still creates audit record in transaction
   *
   * @param {Effect} effect - Already-loaded effect object from database
   * @param {unknown} entity - Entity context (before patch application)
   * @param {UserContext} user - User context for audit logging
   * @param {boolean} dryRun - Whether to preview without persisting
   * @param {boolean} [skipEntityUpdate=false] - Whether to skip entity update (audit-only mode)
   * @returns {Promise<EffectExecutionResult>} Execution result
   * @private
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
   * Execute all active effects for an entity at a specific timing phase.
   *
   * Primary method for batch effect execution during event/encounter resolution workflows.
   * Loads all active effects matching the entity and timing phase, then executes them
   * sequentially in priority order (ascending).
   *
   * 3-Phase Timing Model:
   * - PRE: Pre-resolution effects (validation, setup, pre-conditions)
   * - ON_RESOLVE: Resolution effects (state changes, main logic)
   * - POST: Post-resolution effects (cleanup, notifications, side effects)
   *
   * Execution Behavior:
   * - Effects execute sequentially in priority order (lower priority first)
   * - Entity is loaded once and reused for all effects (consistency)
   * - Failed effects are logged but don't block other effects
   * - Each effect creates an independent audit record
   * - Returns summary with total/succeeded/failed counts
   *
   * Skip-Update Mode:
   * - When skipEntityUpdate=true, effects create audit records but don't update entity
   * - Used in resolve/complete workflows where entity is updated once at the end
   * - Allows effect audit trail without redundant database updates
   *
   * @param {EntityType} entityType - Type of entity (ENCOUNTER, EVENT, SETTLEMENT, STRUCTURE)
   * @param {string} entityId - Unique identifier of entity
   * @param {string} timing - Timing phase (PRE, ON_RESOLVE, POST)
   * @param {UserContext} user - User context for authorization and audit trail
   * @param {boolean} [skipEntityUpdate=false] - Whether to skip entity updates (audit-only mode)
   * @returns {Promise<EffectExecutionSummary>} Summary with counts, results, and execution order
   * @throws {NotFoundException} If entity not found
   *
   * @example
   * // Execute PRE effects during encounter resolution
   * const summary = await service.executeEffectsForEntity(
   *   'ENCOUNTER',
   *   'encounter-123',
   *   'PRE',
   *   { id: 'user-1', email: 'user@example.com' },
   *   false
   * );
   * console.log(`${summary.succeeded}/${summary.total} effects succeeded`);
   *
   * @example
   * // Execute POST effects in audit-only mode (entity updated separately)
   * const summary = await service.executeEffectsForEntity(
   *   'EVENT',
   *   'event-456',
   *   'POST',
   *   { id: 'user-1', email: 'user@example.com' },
   *   true // Skip entity updates
   * );
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
   * Execute multiple effects in dependency order using topological sort.
   *
   * **NOT YET IMPLEMENTED** - Requires Stage 7 (Dependency Graph Integration)
   *
   * Future Functionality:
   * - Load multiple effects by ID
   * - Query DependencyGraphService for topological order
   * - Execute effects in dependency order (dependencies first)
   * - Detect circular dependencies and fail fast
   * - Return summary with both execution order and dependency order
   *
   * Implementation Requirements:
   * - Campaign ID extraction from effect entities
   * - Branch ID support for world-state time travel
   * - Effect-level dependency tracking (currently only tracks conditions/variables)
   * - DependencyGraphService integration for topological sort
   *
   * Use Case:
   * - Complex effect chains with dependencies
   * - Multi-entity operations requiring ordering
   * - Cascading effects across entity relationships
   *
   * @param {string[]} _effectIds - Array of effect IDs to execute (unused until implementation)
   * @param {unknown} _context - Entity context to use for all effects (unused until implementation)
   * @param {UserContext} _user - User context for authorization and audit (unused until implementation)
   * @returns {Promise<DependencyExecutionSummary>} Never returns (throws NotImplementedException)
   * @throws {NotImplementedException} Always thrown until Stage 7 dependency graph integration completed
   *
   * @see {@link DependencyGraphService} Future dependency for topological sort
   * @see {@link executeEffectsForEntity} Current method for priority-based batch execution
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
   * Load entity from database by type and ID.
   *
   * Fetches the specified entity from the appropriate Prisma model table.
   * Filters out soft-deleted entities (deletedAt != null).
   *
   * @param {EntityType} entityType - Type of entity (ENCOUNTER, EVENT, SETTLEMENT, STRUCTURE)
   * @param {string} entityId - Unique identifier of entity
   * @returns {Promise<PatchableEntity | null>} Entity object or null if not found or deleted
   * @throws {BadRequestException} If entityType is not supported
   * @private
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
   * Update entity in database with patched data.
   *
   * Persists the patched entity to the appropriate Prisma model table.
   * Must be called within a Prisma transaction to ensure atomicity with audit logging.
   *
   * @param {EntityType} entityType - Type of entity (ENCOUNTER, EVENT, SETTLEMENT, STRUCTURE)
   * @param {string} entityId - Unique identifier of entity
   * @param {PatchableEntity} patchedEntity - Entity object after JSON Patch application
   * @param {Prisma.TransactionClient} tx - Prisma transaction client for atomic operations
   * @returns {Promise<void>}
   * @throws {BadRequestException} If entityType is not supported
   * @private
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
   * Create audit record for effect execution.
   *
   * Persists an EffectExecution record capturing the execution event with:
   * - Entity context snapshot (before patch application)
   * - Execution result (success/failure, applied patch)
   * - User who triggered execution
   * - Timestamp and error details
   *
   * Audit Trail Usage:
   * - Historical record of all effect executions
   * - Debugging and troubleshooting failed effects
   * - Compliance and accountability tracking
   * - Rollback and undo operations (future feature)
   *
   * @param {Effect} effect - Effect that was executed
   * @param {unknown} entity - Entity context snapshot before patch application
   * @param {object} result - Execution result object
   * @param {boolean} result.success - Whether execution succeeded
   * @param {unknown | null} result.patchApplied - Applied JSON Patch operations or null if failed
   * @param {string} userId - ID of user who triggered execution
   * @param {string | null} [error=null] - Error message if execution failed
   * @returns {Promise<EffectExecution>} Created audit record
   * @private
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
   * Extract affected field paths from JSON Patch operations.
   *
   * Parses the patch operations to identify which entity fields were modified.
   * Includes both target paths (op.path) and source paths (op.from for copy/move).
   *
   * Used For:
   * - Audit record metadata (tracking which fields changed)
   * - Cache invalidation (knowing which fields to refresh)
   * - Dependency analysis (identifying affected computed fields)
   *
   * @param {Operation[]} operations - Array of JSON Patch operations (RFC 6902 format)
   * @returns {string[]} Array of unique field paths (JSON Pointer format)
   *
   * @example
   * const ops = [
   *   { op: "replace", path: "/status", value: "RESOLVED" },
   *   { op: "add", path: "/tags/-", value: "urgent" },
   *   { op: "move", from: "/oldField", path: "/newField" }
   * ];
   * const affected = extractAffectedFields(ops);
   * // Returns: ["/status", "/tags/-", "/newField", "/oldField"]
   *
   * @private
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
   * Map entity type to patchable entity type.
   *
   * Converts EntityType enum to PatchableEntityType for EffectPatchService.
   * Currently a simple pass-through cast, but allows for future type mapping logic.
   *
   * @param {EntityType} entityType - Entity type from effect (ENCOUNTER, EVENT, SETTLEMENT, STRUCTURE)
   * @returns {PatchableEntityType} Mapped type for EffectPatchService
   * @private
   */
  private mapToPatchableEntityType(entityType: EntityType): PatchableEntityType {
    return entityType as PatchableEntityType;
  }
}
