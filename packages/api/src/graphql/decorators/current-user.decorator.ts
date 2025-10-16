/**
 * CurrentUser Decorator
 * Extracts the authenticated user from GraphQL context
 * Usage: @CurrentUser() user: AuthenticatedUser
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import type { GraphQLContext } from '../context/graphql-context';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const ctx = GqlExecutionContext.create(context);
  const gqlContext = ctx.getContext<GraphQLContext>();
  return gqlContext.user;
});
