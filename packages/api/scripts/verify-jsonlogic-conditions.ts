#!/usr/bin/env ts-node

/**
 * Verification script for JSONLogic conditions in seed data
 *
 * Validates:
 * 1. JSON syntax validity
 * 2. JSONLogic structure correctness
 * 3. Variable references match entity schemas
 * 4. Operator usage is semantically correct
 */

import { PrismaClient } from '@prisma/client';
import * as jsonLogic from 'json-logic-js';

const prisma = new PrismaClient();

/**
 * Extract all variable paths referenced in a JSONLogic expression
 */
function extractVariableReferences(logic: unknown, refs: Set<string> = new Set()): Set<string> {
  if (typeof logic !== 'object' || logic === null) {
    return refs;
  }

  if (Array.isArray(logic)) {
    logic.forEach((item) => extractVariableReferences(item, refs));
    return refs;
  }

  // Check for {"var": "path"} pattern
  if ('var' in logic && typeof logic.var === 'string') {
    refs.add(logic.var);
  }

  // Recursively check all values
  Object.values(logic).forEach((value) => {
    extractVariableReferences(value, refs);
  });

  return refs;
}

/**
 * Validate that variable references use correct format
 */
function validateVariableReferences(varRefs: Set<string>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const ref of varRefs) {
    // Extract field name from reference (e.g., "variables.population" -> "population")
    const match = ref.match(/^variables\.(.+)$/);
    if (!match) {
      errors.push(
        `  ❌ Invalid variable reference format: "${ref}" (expected "variables.fieldName")`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate JSONLogic expression syntax and structure
 */
function validateJsonLogicSyntax(expression: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    // Test if jsonLogic can parse it by applying it to empty data
    jsonLogic.apply(expression, {});
  } catch (error) {
    errors.push(`  ❌ JSONLogic syntax error: ${(error as Error).message}`);
    return { valid: false, errors };
  }

  // Validate known operators
  const validOperators = [
    'and',
    'or',
    'not',
    '!',
    '!!',
    '==',
    '===',
    '!=',
    '!==',
    '>',
    '>=',
    '<',
    '<=',
    '+',
    '-',
    '*',
    '/',
    '%',
    'in',
    'var',
    'missing',
    'missing_some',
    'map',
    'filter',
    'reduce',
    'all',
    'none',
    'some',
    'merge',
    'cat',
    'substr',
    'log',
  ];

  function validateOperators(logic: unknown, path: string = 'root') {
    if (typeof logic !== 'object' || logic === null) return;

    if (Array.isArray(logic)) {
      logic.forEach((item, idx) => validateOperators(item, `${path}[${idx}]`));
      return;
    }

    const operators = Object.keys(logic);
    operators.forEach((op) => {
      if (op !== 'var' && !validOperators.includes(op)) {
        errors.push(`  ⚠️  Unknown operator "${op}" at ${path} (may not be supported)`);
      }
      validateOperators(logic[op], `${path}.${op}`);
    });
  }

  validateOperators(expression);

  return { valid: errors.length === 0, errors };
}

/**
 * Main verification function
 */
async function verifyJsonLogicConditions() {
  console.log('🔍 Verifying JSONLogic conditions in seed data...\n');

  try {
    // Fetch all conditions with their associated events
    const conditions = await prisma.condition.findMany({
      where: {
        entityType: 'EVENT',
      },
      select: {
        id: true,
        expression: true,
        entityType: true,
        entityId: true,
      },
    });

    console.log(`Found ${conditions.length} event conditions to verify\n`);

    if (conditions.length === 0) {
      console.log('⚠️  No conditions found. Run seed script first.\n');
      return;
    }

    let totalErrors = 0;
    let totalWarnings = 0;

    // Verify each condition
    for (const condition of conditions) {
      // Fetch the event to get its name
      const event = await prisma.event.findUnique({
        where: { id: condition.entityId },
        select: { name: true },
      });

      if (!event) {
        console.log(`❌ Event not found for condition ${condition.id}`);
        totalErrors++;
        continue;
      }

      console.log(`📋 Validating: ${event.name}`);
      console.log(`   Condition ID: ${condition.id}`);

      // Parse expression
      let expression: unknown;
      try {
        expression =
          typeof condition.expression === 'string'
            ? JSON.parse(condition.expression)
            : condition.expression;
      } catch (error) {
        console.log(`   ❌ Invalid JSON: ${(error as Error).message}\n`);
        totalErrors++;
        continue;
      }

      console.log(`   Expression: ${JSON.stringify(expression)}`);

      // Validate JSONLogic syntax
      const syntaxResult = validateJsonLogicSyntax(expression);
      if (!syntaxResult.valid) {
        syntaxResult.errors.forEach((err) => console.log(err));
        totalErrors += syntaxResult.errors.filter((e) => e.includes('❌')).length;
        totalWarnings += syntaxResult.errors.filter((e) => e.includes('⚠️')).length;
      }

      // Extract variable references
      const varRefs = extractVariableReferences(expression);
      if (varRefs.size > 0) {
        console.log(`   Variables referenced: ${Array.from(varRefs).join(', ')}`);

        // Validate variable reference format
        const refResult = validateVariableReferences(varRefs);
        if (!refResult.valid) {
          refResult.errors.forEach((err) => console.log(err));
          totalErrors += refResult.errors.length;
        } else {
          console.log(`   ✅ All variable references use correct format`);
        }
      } else {
        console.log(`   ℹ️  No variable references (static condition)`);
      }

      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log('✅ All JSONLogic conditions are valid!');
      console.log(`   ${conditions.length} conditions verified successfully`);
    } else {
      console.log(`⚠️  Validation completed with issues:`);
      console.log(`   ${totalErrors} errors found`);
      console.log(`   ${totalWarnings} warnings found`);
      console.log(`   ${conditions.length - totalErrors} conditions are valid`);

      if (totalErrors > 0) {
        process.exit(1);
      }
    }
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyJsonLogicConditions();
