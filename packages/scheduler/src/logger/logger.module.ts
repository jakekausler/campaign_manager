/**
 * Logger Module
 * Provides structured logging with Winston
 */

import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [
    ConfigModule,
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logLevel = String(configService.get('LOG_LEVEL') || 'info');
        const nodeEnv = configService.get('NODE_ENV') || 'development';

        // Use JSON format in production, human-readable in development
        const format =
          nodeEnv === 'production'
            ? winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
              )
            : winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                  const contextStr = context ? `[${context}] ` : '';
                  const metaStr = Object.keys(meta).length
                    ? `\n${JSON.stringify(meta, null, 2)}`
                    : '';
                  return `${timestamp} ${level} ${contextStr}${message}${metaStr}`;
                })
              );

        return {
          level: logLevel,
          format,
          transports: [
            new winston.transports.Console({
              handleExceptions: true,
              handleRejections: true,
            }),
          ],
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}
