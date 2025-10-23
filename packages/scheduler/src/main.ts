import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);

    // Get port from configuration
    const port = configService.port;

    await app.listen(port);

    logger.log(`Scheduler service listening on port ${port}`);
    logger.log(`Environment: ${configService.nodeEnv}`);
    logger.log(`Log level: ${configService.logLevel}`);
    // Don't log full URLs as they may contain credentials
    const redisHost = new URL(configService.redisUrl).host;
    const apiHost = new URL(configService.apiUrl).origin;
    logger.log(`Redis host: ${redisHost}`);
    logger.log(`API endpoint: ${apiHost}`);
    logger.log('Health check available at GET /health');
  } catch (error) {
    logger.error('Failed to start scheduler service', error);
    process.exit(1);
  }
}

bootstrap();
