/**
 * Rules Module
 * Provides expression parsing and evaluation services for the Rules Engine
 */

import { Module } from '@nestjs/common';

import { ExpressionCache } from './cache/expression-cache';
import { ExpressionParserService } from './expression-parser.service';
import { OperatorRegistry } from './operator-registry';

/**
 * RulesModule
 *
 * Encapsulates the Rules Engine subsystem including:
 * - Expression parsing and evaluation (JSONLogic)
 * - Custom operator registry
 * - Expression caching for performance optimization
 * - Future: Expression validation, sandboxing
 *
 * Services are singleton-scoped and shared across the application.
 */
@Module({
  providers: [ExpressionParserService, OperatorRegistry, ExpressionCache],
  exports: [ExpressionParserService, OperatorRegistry, ExpressionCache],
})
export class RulesModule {}
