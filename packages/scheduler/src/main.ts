import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { BullBoardModule } from './queue/bull-board.module';
import { QueueModule } from './queue/queue.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true, // Buffer logs until logger is ready
    });

    // Use Winston logger for all NestJS logs
    app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

    const configService = app.get(ConfigService);

    // Mount Bull Board UI in development
    if (configService.nodeEnv === 'development') {
      const queueModule = app.select(QueueModule);
      const bullBoardModule = queueModule.get(BullBoardModule, { strict: false });
      const bullBoardRouter = bullBoardModule.getRouter();

      if (bullBoardRouter) {
        app.use('/admin/queues', bullBoardRouter);
        logger.log('Bull Board UI available at /admin/queues');
      }
    }

    // Enable graceful shutdown hooks
    app.enableShutdownHooks();

    // Setup graceful shutdown handlers
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.log(`Received ${signal}, starting graceful shutdown...`);
        try {
          await app.close();
          logger.log('Application closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', error);
          process.exit(1);
        }
      });
    });

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
    logger.log('Queue metrics available at GET /metrics');
    logger.log('Graceful shutdown enabled for SIGTERM and SIGINT');
  } catch (error) {
    logger.error('Failed to start scheduler service', error);
    process.exit(1);
  }
}

bootstrap();
