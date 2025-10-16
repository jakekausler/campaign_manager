/**
 * OptimisticLockException
 * Thrown when an entity update fails due to version mismatch (concurrent edit detection)
 */

import { ConflictException } from '@nestjs/common';

/**
 * Exception thrown when optimistic locking detects a concurrent modification
 */
export class OptimisticLockException extends ConflictException {
  constructor(
    message: string = 'The entity was modified by another user. Please refresh and try again.',
    public readonly expectedVersion?: number,
    public readonly actualVersion?: number
  ) {
    super(message);
    this.name = 'OptimisticLockException';
  }
}
