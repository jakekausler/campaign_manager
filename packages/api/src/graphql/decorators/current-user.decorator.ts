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

  // CRITICAL: Read from req.user instead of context.user because:
  // 1. Context is created BEFORE guards run (req.user is undefined)
  // 2. Guards run and set req.user
  // 3. Resolvers run and need to read the CURRENT value from req.user
  //
  // If we read context.user, we get the value that was captured during
  // context creation (undefined). By reading req.user directly, we get
  // the value set by guards.
  return gqlContext.req.user;
});
