/**
 * TypeScript interfaces generated from proto/rules-engine.proto
 * These types match the Protocol Buffer definitions for the Rules Engine gRPC service
 */

/**
 * A single step in the evaluation trace
 */
export interface TraceStep {
  step: number;
  description: string;
  inputJson: string | null;
  outputJson: string | null;
  passed: boolean;
}

/**
 * Result of a condition evaluation
 */
export interface EvaluationResult {
  success: boolean;
  valueJson: string | null;
  error: string | null;
  trace: TraceStep[];
  evaluationTimeMs: number;
}

/**
 * Request to evaluate a single condition
 */
export interface EvaluateConditionRequest {
  conditionId: string;
  campaignId: string;
  branchId: string;
  contextJson: string;
  includeTrace: boolean;
}

/**
 * Request to evaluate multiple conditions
 */
export interface EvaluateConditionsRequest {
  conditionIds: string[];
  campaignId: string;
  branchId: string;
  contextJson: string;
  includeTrace: boolean;
  useDependencyOrder: boolean;
}

/**
 * Response with multiple evaluation results
 */
export interface EvaluateConditionsResponse {
  results: Record<string, EvaluationResult>;
  totalEvaluationTimeMs: number;
  evaluationOrder: string[];
}

/**
 * Request to get evaluation order
 */
export interface GetEvaluationOrderRequest {
  campaignId: string;
  branchId: string;
  conditionIds: string[];
}

/**
 * Response with evaluation order
 */
export interface EvaluationOrderResponse {
  nodeIds: string[];
  totalNodes: number;
}

/**
 * Request to validate dependencies
 */
export interface ValidateDependenciesRequest {
  campaignId: string;
  branchId: string;
}

/**
 * Result of dependency validation
 */
export interface ValidationResult {
  hasCycle: boolean;
  cycles: string[];
  message: string;
}

/**
 * Request to invalidate cache
 */
export interface InvalidateCacheRequest {
  campaignId: string;
  branchId: string;
  nodeIds: string[];
}

/**
 * Response for cache invalidation
 */
export interface InvalidateCacheResponse {
  invalidatedCount: number;
  message: string;
}

/**
 * Rules Engine Service Interface
 * Defines the contract for the gRPC service
 */
export interface IRulesEngineService {
  evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult>;
  evaluateConditions(request: EvaluateConditionsRequest): Promise<EvaluateConditionsResponse>;
  getEvaluationOrder(request: GetEvaluationOrderRequest): Promise<EvaluationOrderResponse>;
  validateDependencies(request: ValidateDependenciesRequest): Promise<ValidationResult>;
  invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse>;
}
