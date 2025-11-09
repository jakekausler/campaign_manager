import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VariableSchema {
  name: string;
  type: string;
  description?: string;
  defaultValue?: unknown;
  enumValues?: string[];
}

/**
 * Verifies that a variable schema is properly formatted
 */
function validateSchema(schema: VariableSchema, entityType: string, entityName: string): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!schema.name || typeof schema.name !== 'string') {
    errors.push(`${entityType} "${entityName}": Schema missing or has invalid 'name' field`);
  }

  if (!schema.type || typeof schema.type !== 'string') {
    errors.push(
      `${entityType} "${entityName}": Schema for "${schema.name}" missing or has invalid 'type' field`
    );
  }

  // Validate type is one of the allowed types
  const validTypes = ['string', 'number', 'boolean', 'enum'];
  if (schema.type && !validTypes.includes(schema.type)) {
    errors.push(
      `${entityType} "${entityName}": Schema "${schema.name}" has invalid type "${schema.type}" (must be one of: ${validTypes.join(', ')})`
    );
  }

  // If type is enum, enumValues must be present
  if (schema.type === 'enum') {
    if (!schema.enumValues || !Array.isArray(schema.enumValues)) {
      errors.push(
        `${entityType} "${entityName}": Schema "${schema.name}" is type 'enum' but missing or invalid 'enumValues' array`
      );
    } else if (schema.enumValues.length === 0) {
      errors.push(
        `${entityType} "${entityName}": Schema "${schema.name}" has empty 'enumValues' array`
      );
    }
  }

  // Check description is string if present
  if (schema.description && typeof schema.description !== 'string') {
    errors.push(
      `${entityType} "${entityName}": Schema "${schema.name}" has non-string 'description'`
    );
  }

  return errors;
}

/**
 * Verifies that actual variables match the schema
 */
function validateVariablesMatchSchema(
  variables: Record<string, unknown>,
  schemas: VariableSchema[],
  entityType: string,
  entityName: string
): string[] {
  const errors: string[] = [];
  const schemaMap = new Map(schemas.map((s) => [s.name, s]));

  // Check each variable has a corresponding schema
  for (const [varName, varValue] of Object.entries(variables)) {
    const schema = schemaMap.get(varName);
    if (!schema) {
      errors.push(
        `${entityType} "${entityName}": Variable "${varName}" exists but has no corresponding schema`
      );
      continue;
    }

    // Validate variable value matches schema type
    const actualType = typeof varValue;
    const expectedType = schema.type;

    // Special handling for enum type
    if (schema.type === 'enum') {
      if (typeof varValue !== 'string') {
        errors.push(
          `${entityType} "${entityName}": Variable "${varName}" is enum but value is not a string (got ${actualType})`
        );
      } else if (schema.enumValues && !schema.enumValues.includes(varValue as string)) {
        errors.push(
          `${entityType} "${entityName}": Variable "${varName}" value "${varValue}" is not in enumValues [${schema.enumValues.join(', ')}]`
        );
      }
      continue;
    }

    // Check type matches
    if (actualType !== expectedType) {
      errors.push(
        `${entityType} "${entityName}": Variable "${varName}" expected type ${expectedType} but got ${actualType}`
      );
    }
  }

  return errors;
}

async function main() {
  console.log('Verifying settlement and structure typed variables...\n');

  let totalErrors = 0;

  // =====================================================
  // 1. Verify Settlement Variable Schemas
  // =====================================================
  console.log('1. Verifying Settlement Variable Schemas...');

  const settlements = await prisma.settlement.findMany({
    select: {
      id: true,
      name: true,
      variableSchemas: true,
      variables: true,
    },
  });

  if (settlements.length === 0) {
    console.log('   ⚠️  No settlements found');
  } else {
    let settlementErrors = 0;

    for (const settlement of settlements) {
      // Check schemas exist
      if (
        !settlement.variableSchemas ||
        !Array.isArray(settlement.variableSchemas) ||
        settlement.variableSchemas.length === 0
      ) {
        console.log(
          `   ❌ Settlement "${settlement.name}": Missing or empty variableSchemas array`
        );
        settlementErrors++;
        continue;
      }

      // Validate each schema
      const schemas = settlement.variableSchemas as unknown as VariableSchema[];
      for (const schema of schemas) {
        const schemaErrors = validateSchema(schema, 'Settlement', settlement.name);
        if (schemaErrors.length > 0) {
          schemaErrors.forEach((err) => console.log(`   ❌ ${err}`));
          settlementErrors += schemaErrors.length;
        }
      }

      // Validate variables match schemas
      if (settlement.variables && typeof settlement.variables === 'object') {
        const varErrors = validateVariablesMatchSchema(
          settlement.variables as Record<string, unknown>,
          schemas,
          'Settlement',
          settlement.name
        );
        if (varErrors.length > 0) {
          varErrors.forEach((err) => console.log(`   ❌ ${err}`));
          settlementErrors += varErrors.length;
        }
      }
    }

    if (settlementErrors === 0) {
      console.log(`   ✅ All ${settlements.length} settlements have valid typed variables\n`);
    } else {
      console.log(`   ❌ Found ${settlementErrors} errors in settlement typed variables\n`);
      totalErrors += settlementErrors;
    }
  }

  // =====================================================
  // 2. Verify Structure Variable Schemas
  // =====================================================
  console.log('2. Verifying Structure Variable Schemas...');

  const structures = await prisma.structure.findMany({
    select: {
      id: true,
      name: true,
      type: true,
      variableSchemas: true,
      variables: true,
    },
  });

  if (structures.length === 0) {
    console.log('   ⚠️  No structures found');
  } else {
    let structureErrors = 0;

    for (const structure of structures) {
      // Check schemas exist
      if (
        !structure.variableSchemas ||
        !Array.isArray(structure.variableSchemas) ||
        structure.variableSchemas.length === 0
      ) {
        console.log(
          `   ❌ Structure "${structure.name}" (${structure.type}): Missing or empty variableSchemas array`
        );
        structureErrors++;
        continue;
      }

      // Validate each schema
      const schemas = structure.variableSchemas as unknown as VariableSchema[];
      for (const schema of schemas) {
        const schemaErrors = validateSchema(schema, 'Structure', structure.name);
        if (schemaErrors.length > 0) {
          schemaErrors.forEach((err) => console.log(`   ❌ ${err}`));
          structureErrors += schemaErrors.length;
        }
      }

      // Validate variables match schemas
      if (structure.variables && typeof structure.variables === 'object') {
        const varErrors = validateVariablesMatchSchema(
          structure.variables as Record<string, unknown>,
          schemas,
          'Structure',
          structure.name
        );
        if (varErrors.length > 0) {
          varErrors.forEach((err) => console.log(`   ❌ ${err}`));
          structureErrors += varErrors.length;
        }
      }
    }

    if (structureErrors === 0) {
      console.log(`   ✅ All ${structures.length} structures have valid typed variables\n`);
    } else {
      console.log(`   ❌ Found ${structureErrors} errors in structure typed variables\n`);
      totalErrors += structureErrors;
    }
  }

  // =====================================================
  // 3. Summary
  // =====================================================
  console.log('=====================================');
  if (totalErrors === 0) {
    console.log('✅ All typed variables are correctly formatted!');
    process.exit(0);
  } else {
    console.log(`❌ Found ${totalErrors} total errors in typed variables`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Error during verification:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
