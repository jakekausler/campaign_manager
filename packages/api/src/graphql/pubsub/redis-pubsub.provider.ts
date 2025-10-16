/**
 * Redis PubSub Provider
 * Configures Redis for GraphQL subscriptions
 */

import { RedisPubSub } from 'graphql-redis-subscriptions';
import type { RedisOptions } from 'ioredis';

/**
 * Creates and configures a Redis PubSub instance for GraphQL subscriptions
 */
export function createRedisPubSub(): RedisPubSub {
  const options: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3 seconds
      const delay = Math.min(times * 50, 3000);
      return delay;
    },
    // Connection timeout
    connectTimeout: 10000,
    // Enable offline queue to buffer commands when disconnected
    enableOfflineQueue: true,
    // Reconnect on error
    reconnectOnError: (err: Error) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        // Reconnect on READONLY errors
        return true;
      }
      return false;
    },
  };

  const pubsub = new RedisPubSub({
    connection: options,
  });

  // Add error logging for debugging Redis connection issues
  pubsub.getPublisher().on('error', (err) => {
    console.error('Redis Publisher Error:', err);
  });

  pubsub.getSubscriber().on('error', (err) => {
    console.error('Redis Subscriber Error:', err);
  });

  return pubsub;
}

/**
 * Injection token for RedisPubSub
 */
export const REDIS_PUBSUB = 'REDIS_PUBSUB';
