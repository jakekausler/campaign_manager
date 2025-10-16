/**
 * DateTime Scalar
 * Handles Date objects as ISO 8601 strings in GraphQL
 */

import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description = 'Date custom scalar type (ISO 8601)';

  // Serialize Date to string for sending to client
  serialize(value: unknown): string {
    if (!(value instanceof Date)) {
      throw new Error('DateTimeScalar can only serialize Date objects');
    }
    return value.toISOString();
  }

  // Parse string from client to Date object
  parseValue(value: unknown): Date {
    if (typeof value !== 'string') {
      throw new Error('DateTimeScalar can only parse string values');
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${value}`);
    }
    return date;
  }

  // Parse AST literal to Date object
  parseLiteral(ast: ValueNode): Date {
    if (ast.kind === Kind.STRING) {
      const date = new Date(ast.value);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date string: ${ast.value}`);
      }
      return date;
    }
    throw new Error('DateTimeScalar can only parse string literals');
  }
}
