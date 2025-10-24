/**
 * Alerting Service
 * Handles critical failure notifications and alerting hooks
 */

import { Injectable, Logger } from '@nestjs/common';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface Alert {
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Service for managing alerts and critical failure notifications.
 * Provides hooks for integrating with external alerting systems.
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly alertHandlers: Array<(alert: Alert) => Promise<void>> = [];

  constructor() {
    // Register default handler: structured logging
    this.registerHandler(this.logAlert.bind(this));
  }

  /**
   * Register a custom alert handler
   * @param handler Async function to handle alerts
   */
  registerHandler(handler: (alert: Alert) => Promise<void>): void {
    this.alertHandlers.push(handler);
  }

  /**
   * Send an alert to all registered handlers
   */
  async sendAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const alert: Alert = {
      severity,
      title,
      message,
      timestamp: new Date(),
      metadata,
    };

    // Execute all handlers in parallel
    const results = await Promise.allSettled(this.alertHandlers.map((handler) => handler(alert)));

    // Log any handler failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Alert handler ${index} failed: ${result.reason instanceof Error ? result.reason.message : result.reason}`
        );
      }
    });
  }

  /**
   * Send a critical alert
   */
  async critical(
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.sendAlert(AlertSeverity.CRITICAL, title, message, metadata);
  }

  /**
   * Send a warning alert
   */
  async warning(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert(AlertSeverity.WARNING, title, message, metadata);
  }

  /**
   * Send an info alert
   */
  async info(title: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.sendAlert(AlertSeverity.INFO, title, message, metadata);
  }

  /**
   * Default alert handler: structured logging
   */
  private async logAlert(alert: Alert): Promise<void> {
    const logMessage = `[ALERT] ${alert.title}: ${alert.message}`;

    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        this.logger.error(logMessage, {
          alert: {
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
            metadata: alert.metadata,
          },
        });
        break;
      case AlertSeverity.WARNING:
        this.logger.warn(logMessage, {
          alert: {
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
            metadata: alert.metadata,
          },
        });
        break;
      case AlertSeverity.INFO:
        this.logger.log(logMessage, {
          alert: {
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
            metadata: alert.metadata,
          },
        });
        break;
    }
  }
}
