/**
 * Campaign Management Tool - Rules Engine Worker Entry Point
 * NestJS-based worker service for rules evaluation with gRPC and HTTP
 */

import { join } from 'path';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('RulesEngineBootstrap');

  logger.log('Starting Rules Engine Worker...');

  // Create hybrid application with both HTTP and gRPC
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

  // Configure and connect gRPC microservice
  const grpcPort = process.env.GRPC_PORT || '50051';
  const grpcUrl = `0.0.0.0:${grpcPort}`;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'rulesengine',
      protoPath: join(__dirname, '../proto/rules-engine.proto'),
      url: grpcUrl,
      loader: {
        keepCase: false,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    },
  });

  // Start all microservices
  await app.startAllMicroservices();
  logger.log(`gRPC server listening on ${grpcUrl}`);

  // Start HTTP health check endpoint
  const httpPort = process.env.HTTP_PORT || 3001;
  await app.listen(httpPort);

  logger.log(`HTTP health check endpoint listening on port ${httpPort}`);
  logger.log('Rules Engine Worker ready to process evaluation requests');
}

bootstrap().catch((error) => {
  console.error('Failed to start Rules Engine Worker:', error);
  process.exit(1);
});
