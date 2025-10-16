/**
 * Prisma Service - Database connection and client management
 *
 * This service provides:
 * - Singleton Prisma Client instance with connection pooling
 * - Lifecycle hooks for NestJS integration
 * - Query logging and error handling
 */

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      this.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // Log all errors
    this.$on('error' as never, (e: { message: string; target: string }) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.target);
    });
  }

  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Clean up database connections (for testing)
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase can only be called in test environment');
    }

    const models = Object.keys(this).filter((key) => !key.startsWith('_') && !key.startsWith('$'));

    // Delete all records in reverse order to handle foreign key constraints
    for (const model of models.reverse()) {
      const delegate = this[model as keyof this];
      if (delegate && typeof delegate === 'object' && 'deleteMany' in delegate) {
        await (delegate as { deleteMany: () => Promise<unknown> }).deleteMany();
      }
    }
  }
}
