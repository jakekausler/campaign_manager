import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaService } from '../database/prisma.service';

import { AuthController } from './auth.controller';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ApiKeyService } from './services/api-key.service';
import { AuthService } from './services/auth.service';
import { CampaignMembershipService } from './services/campaign-membership.service';
import { PermissionsService } from './services/permissions.service';
import { UsersService } from './services/users.service';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        (() => {
          throw new Error('JWT_SECRET environment variable is not set');
        })(),
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    CampaignMembershipService,
    PermissionsService,
    ApiKeyService,
    LocalStrategy,
    JwtStrategy,
    ApiKeyStrategy,
    JwtAuthGuard,
    RolesGuard,
    ApiKeyAuthGuard,
    PrismaService,
  ],
  exports: [
    AuthService,
    UsersService,
    CampaignMembershipService,
    PermissionsService,
    ApiKeyService,
    JwtAuthGuard,
    RolesGuard,
    ApiKeyAuthGuard,
  ],
})
export class AuthModule {}
