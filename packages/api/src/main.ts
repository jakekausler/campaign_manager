/**
 * Campaign Management Tool - API Entry Point
 * NestJS GraphQL API Server
 */

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  // Validate required environment variables
  if (!process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required for security. Please set it in your .env file.'
    );
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security.');
  }
  const app = await NestFactory.create(AppModule);

  // Enable CORS with restricted origins
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:9263'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
    })
  );

  const port = process.env.PORT || 9264;
  await app.listen(port);

  console.log(`API server running on http://localhost:${port}`);
}

bootstrap();
