import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { CacheModule } from './common/cache/cache.module';
import { GraphQLConfigModule } from './graphql/graphql.module';
import { WebSocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window: 60 seconds
        limit: 10, // Max 10 requests per window for auth endpoints
      },
    ]),
    // Global cache layer (Redis DB 1)
    CacheModule,
    AuthModule,
    GraphQLConfigModule,
    WebSocketModule,
  ],
  providers: [
    // Note: JWT auth guard is NOT applied globally. Instead, each resolver
    // uses explicit guards (@UseGuards) to support both JWT and API key auth.
    // This allows the JwtOrApiKeyAuthGuard to handle multiple auth strategies.

    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
