#!/usr/bin/env ts-node

/**
 * Verification script for JSON Patch effects in seed data
 *
 * Validates:
 * 1. JSON syntax validity
 * 2. RFC 6902 compliance (valid operations, paths, values)
 * 3. Path format correctness (/variables/fieldName)
 * 4. Value types are appropriate for operations
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Valid JSON Patch operations according to RFC 6902
 */
const VALID_OPERATIONS = ['add', 'remove', 'replace', 'move', 'copy', 'test'] as const;

/**
 * Validate JSON Patch operation structure
 */
function validatePatchOperation(
  operation: unknown,
  index: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must be an object
  if (typeof operation !== 'object' || operation === null || Array.isArray(operation)) {
    errors.push(`  ❌ Operation ${index}: Must be an object`);
    return { valid: false, errors };
  }

  // Must have 'op' field
  if (!('op' in operation)) {
    errors.push(`  ❌ Operation ${index}: Missing required 'op' field`);
    return { valid: false, errors };
  }

  // Validate 'op' value
  if (!VALID_OPERATIONS.includes(operation.op)) {
    errors.push(
      `  ❌ Operation ${index}: Invalid 'op' value "${operation.op}" (must be one of: ${VALID_OPERATIONS.join(', ')})`
    );
  }

  // Must have 'path' field
  if (!('path' in operation)) {
    errors.push(`  ❌ Operation ${index}: Missing required 'path' field`);
    return { valid: false, errors };
  }

  // Validate 'path' format
  if (typeof operation.path !== 'string') {
    errors.push(`  ❌ Operation ${index}: 'path' must be a string`);
  } else if (!operation.path.startsWith('/')) {
    errors.push(`  ❌ Operation ${index}: 'path' must start with '/' (JSON Pointer format)`);
  } else if (!operation.path.startsWith('/variables/')) {
    errors.push(
      `  ⚠️  Operation ${index}: 'path' "${operation.path}" does not start with '/variables/' (may not target entity variables)`
    );
  }

  // Validate operation-specific requirements
  switch (operation.op) {
    case 'add':
    case 'replace':
    case 'test':
      // These operations require a 'value' field
      if (!('value' in operation)) {
        errors.push(
          `  ❌ Operation ${index}: '${operation.op}' operation requires a 'value' field`
        );
      }
      break;

    case 'move':
    case 'copy':
      // These operations require a 'from' field
      if (!('from' in operation)) {
        errors.push(`  ❌ Operation ${index}: '${operation.op}' operation requires a 'from' field`);
      } else if (typeof operation.from !== 'string' || !operation.from.startsWith('/')) {
        errors.push(
          `  ❌ Operation ${index}: 'from' must be a string starting with '/' (JSON Pointer format)`
        );
      }
      break;

    case 'remove':
      // Remove only requires 'op' and 'path'
      break;
  }

  // Check for extraneous fields
  const validFields = ['op', 'path', 'value', 'from'];
  const extraFields = Object.keys(operation).filter((key) => !validFields.includes(key));
  if (extraFields.length > 0) {
    errors.push(
      `  ⚠️  Operation ${index}: Unexpected fields: ${extraFields.join(', ')} (may be ignored)`
    );
  }

  return { valid: errors.filter((e) => e.includes('❌')).length === 0, errors };
}

/**
 * Validate JSON Patch document (array of operations)
 */
function validatePatchDocument(patch: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Must be an array
  if (!Array.isArray(patch)) {
    errors.push(`  ❌ JSON Patch must be an array of operations`);
    return { valid: false, errors };
  }

  // Must have at least one operation
  if (patch.length === 0) {
    errors.push(`  ⚠️  JSON Patch is empty (no operations to apply)`);
  }

  // Validate each operation
  patch.forEach((operation, index) => {
    const result = validatePatchOperation(operation, index);
    errors.push(...result.errors);
  });

  return { valid: errors.filter((e) => e.includes('❌')).length === 0, errors };
}

/**
 * Main verification function
 */
async function verifyJsonPatchEffects() {
  console.log('🔍 Verifying JSON Patch effects in seed data...\n');

  try {
    // Fetch all effects with their associated events
    const effects = await prisma.effect.findMany({
      where: {
        entityType: 'EVENT',
      },
      select: {
        id: true,
        payload: true,
        timing: true,
        priority: true,
        entityType: true,
        entityId: true,
      },
    });

    console.log(`Found ${effects.length} event effects to verify\n`);

    if (effects.length === 0) {
      console.log('⚠️  No effects found. Run seed script first.\n');
      return;
    }

    let totalErrors = 0;
    let totalWarnings = 0;

    // Verify each effect
    for (const effect of effects) {
      // Fetch the event to get its name
      const event = await prisma.event.findUnique({
        where: { id: effect.entityId },
        select: { name: true },
      });

      if (!event) {
        console.log(`❌ Event not found for effect ${effect.id}`);
        totalErrors++;
        continue;
      }

      console.log(`📋 Validating: ${event.name}`);
      console.log(`   Effect ID: ${effect.id}`);
      console.log(`   Timing: ${effect.timing}`);
      console.log(`   Priority: ${effect.priority}`);

      // Parse payload (contains JSON Patch operations)
      let operations: unknown;
      try {
        operations =
          typeof effect.payload === 'string' ? JSON.parse(effect.payload) : effect.payload;
      } catch (error) {
        console.log(`   ❌ Invalid JSON: ${(error as Error).message}\n`);
        totalErrors++;
        continue;
      }

      console.log(`   Operations: ${JSON.stringify(operations)}`);

      // Validate JSON Patch document
      const validationResult = validatePatchDocument(operations);

      // Display errors and warnings
      const errorsFound = validationResult.errors.filter((e) => e.includes('❌'));
      const warningsFound = validationResult.errors.filter((e) => e.includes('⚠️'));

      if (errorsFound.length > 0) {
        errorsFound.forEach((err) => console.log(err));
        totalErrors += errorsFound.length;
      }

      if (warningsFound.length > 0) {
        warningsFound.forEach((warn) => console.log(warn));
        totalWarnings += warningsFound.length;
      }

      if (validationResult.valid) {
        console.log(`   ✅ All operations are valid RFC 6902 JSON Patch operations`);
      }

      console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log('✅ All JSON Patch effects are valid!');
      console.log(`   ${effects.length} effects verified successfully`);
    } else {
      console.log(`⚠️  Validation completed with issues:`);
      console.log(`   ${totalErrors} errors found`);
      console.log(`   ${totalWarnings} warnings found`);
      console.log(`   ${effects.length} effects verified`);

      if (totalErrors > 0) {
        console.log('\n❌ Validation failed due to errors');
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
verifyJsonPatchEffects();
