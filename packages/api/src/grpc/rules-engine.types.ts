/**
 * TypeScript types for Rules Engine gRPC service
 * Generated from proto/rules-engine.proto
 */

export interface EvaluateConditionRequest {
  conditionId: string;
  campaignId: string;
  branchId?: string;
  contextJson: string;
  includeTrace?: boolean;
}

export interface EvaluationResult {
  success: boolean;
  valueJson?: string;
  error?: string;
  trace?: TraceStep[];
  evaluationTimeMs?: number;
}

export interface TraceStep {
  step: number;
  description: string;
  inputJson?: string;
  outputJson?: string;
  passed: boolean;
}

export interface EvaluateConditionsRequest {
  conditionIds: string[];
  campaignId: string;
  branchId?: string;
  contextJson: string;
  includeTrace?: boolean;
  useDependencyOrder?: boolean;
}

export interface EvaluateConditionsResponse {
  results: { [key: string]: EvaluationResult };
  totalEvaluationTimeMs?: number;
  evaluationOrder?: string[];
}

export interface GetEvaluationOrderRequest {
  campaignId: string;
  branchId?: string;
  conditionIds?: string[];
}

export interface EvaluationOrderResponse {
  nodeIds: string[];
  totalNodes?: number;
}

export interface ValidateDependenciesRequest {
  campaignId: string;
  branchId?: string;
}

export interface ValidationResult {
  hasCycle: boolean;
  cycles?: string[];
  message?: string;
}

export interface InvalidateCacheRequest {
  campaignId: string;
  branchId?: string;
  nodeIds?: string[];
}

export interface InvalidateCacheResponse {
  invalidatedCount?: number;
  message?: string;
}

export interface GetCacheStatsRequest {
  campaignId?: string;
  branchId?: string;
}

export interface CacheStatsResponse {
  hits?: number;
  misses?: number;
  keys?: number;
  ksize?: number;
  vsize?: number;
  hitRate?: number;
  sampleKeys?: string[];
}

/**
 * Rules Engine gRPC Service Client Interface
 */
export interface IRulesEngineClient {
  evaluateCondition(request: EvaluateConditionRequest): Promise<EvaluationResult>;

  evaluateConditions(request: EvaluateConditionsRequest): Promise<EvaluateConditionsResponse>;

  getEvaluationOrder(request: GetEvaluationOrderRequest): Promise<EvaluationOrderResponse>;

  validateDependencies(request: ValidateDependenciesRequest): Promise<ValidationResult>;

  invalidateCache(request: InvalidateCacheRequest): Promise<InvalidateCacheResponse>;

  getCacheStats(request: GetCacheStatsRequest): Promise<CacheStatsResponse>;
}
