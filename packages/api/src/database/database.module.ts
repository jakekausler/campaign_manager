/**
 * Database Module
 * Provides Prisma service and database utilities for the application
 */

import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * DatabaseModule is marked as Global to make PrismaService available
 * throughout the application without explicit imports in each module.
 *
 * This is a common pattern for database providers in NestJS applications.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
