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

/**
 * PrismaService - Central database connection manager
 *
 * Provides a singleton Prisma Client instance for the entire application,
 * managing database connections, query logging, and error handling. This
 * service integrates with NestJS lifecycle hooks to ensure proper connection
 * initialization and cleanup.
 *
 * The service is injected into repositories and other services that need
 * database access. It extends PrismaClient directly, so all Prisma Client
 * methods are available on instances of this service.
 *
 * Features:
 * - Automatic database connection on module initialization
 * - Graceful disconnection on module destruction
 * - Query logging in development mode (query text, params, duration)
 * - Error logging for all database errors
 * - Test utility for cleaning database state
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Creates a new PrismaService instance with configured logging.
   *
   * Configures the Prisma Client with:
   * - Event-based logging for queries, errors, info, and warnings
   * - Pretty error formatting for better debugging
   * - Development-only query logging (query text, params, duration)
   * - Error event handlers for centralized error logging
   */
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

  /**
   * Lifecycle hook called when the NestJS module is initialized.
   *
   * Establishes the database connection using Prisma's $connect method.
   * This ensures the database connection is ready before the application
   * starts processing requests. Logs connection status for monitoring.
   *
   * @throws Error if database connection fails
   */
  async onModuleInit() {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected successfully');
  }

  /**
   * Lifecycle hook called when the NestJS module is being destroyed.
   *
   * Gracefully closes the database connection using Prisma's $disconnect
   * method. This is called during application shutdown to ensure all
   * pending queries complete and connections are properly released.
   * Logs disconnection status for monitoring.
   */
  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Cleans all data from the database by deleting records from all tables.
   *
   * This method is intended for use in test environments only to reset
   * database state between tests. It deletes all records from all tables
   * in reverse order to handle foreign key constraints properly.
   *
   * IMPORTANT: This method can only be called when NODE_ENV is 'test' to
   * prevent accidental data loss in production or development environments.
   *
   * @throws Error if called outside of test environment
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
