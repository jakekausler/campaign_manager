/**
 * Campaign Management Tool - Rules Engine Worker Entry Point
 * NestJS-based worker service for rules evaluation
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('RulesEngineBootstrap');

  logger.log('Starting Rules Engine Worker...');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // Start HTTP health check endpoint
  const httpPort = process.env.HTTP_PORT || 3001;
  await app.listen(httpPort);

  logger.log(`Rules Engine Worker HTTP health check listening on port ${httpPort}`);
  logger.log('Rules Engine Worker ready to process evaluation requests');
}

bootstrap().catch((error) => {
  console.error('Failed to start Rules Engine Worker:', error);
  process.exit(1);
});
