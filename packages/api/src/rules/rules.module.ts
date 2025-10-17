/**
 * Rules Module
 * Provides expression parsing and evaluation services for the Rules Engine
 */

import { Module } from '@nestjs/common';

import { ExpressionParserService } from './expression-parser.service';
import { OperatorRegistry } from './operator-registry';

/**
 * RulesModule
 *
 * Encapsulates the Rules Engine subsystem including:
 * - Expression parsing and evaluation (JSONLogic)
 * - Custom operator registry
 * - Future: Expression validation, sandboxing, caching
 *
 * Services are singleton-scoped and shared across the application.
 */
@Module({
  providers: [ExpressionParserService, OperatorRegistry],
  exports: [ExpressionParserService, OperatorRegistry],
})
export class RulesModule {}
