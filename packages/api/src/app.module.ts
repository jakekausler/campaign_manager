import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { GraphQLConfigModule } from './graphql/graphql.module';
import { RulesEngineClientService } from './grpc/rules-engine-client.service';

@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // Time window: 60 seconds
        limit: 10, // Max 10 requests per window for auth endpoints
      },
    ]),
    AuthModule,
    GraphQLConfigModule,
  ],
  providers: [
    // Apply JWT auth guard globally
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Rules Engine gRPC client
    RulesEngineClientService,
  ],
  exports: [RulesEngineClientService],
})
export class AppModule {}
