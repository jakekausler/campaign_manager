import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  // Handle both HTTP and GraphQL contexts
  const ctx = GqlExecutionContext.create(context);
  const request = ctx.getContext().req || context.switchToHttp().getRequest();
  return request.user;
});
