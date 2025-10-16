/**
 * JSON Scalar
 * Handles arbitrary JSON objects in GraphQL
 * Used for typed variables and variable schemas
 */

import { Scalar, CustomScalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

@Scalar('JSON')
export class JSONScalar implements CustomScalar<JSONValue, JSONValue> {
  description = 'JSON custom scalar type';

  // Serialize JSON value for sending to client
  serialize(value: unknown): JSONValue {
    return value as JSONValue;
  }

  // Parse JSON value from client
  parseValue(value: unknown): JSONValue {
    return value as JSONValue;
  }

  // Parse AST literal to JSON value
  parseLiteral(ast: ValueNode): JSONValue {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.OBJECT: {
        const value: { [key: string]: JSONValue } = {};
        ast.fields.forEach((field) => {
          value[field.name.value] = this.parseLiteral(field.value);
        });
        return value;
      }
      case Kind.LIST:
        return ast.values.map((n) => this.parseLiteral(n));
      case Kind.NULL:
        return null;
      default:
        throw new Error(`Unexpected kind in parseLiteral: ${ast.kind}`);
    }
  }
}
