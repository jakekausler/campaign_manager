/**
 * Tests for resolution validation utilities
 */

import { describe, it, expect } from 'vitest';

import {
  validateEventResolution,
  validateEncounterResolution,
  validateResolution,
  type Event,
  type Encounter,
} from './resolution-validation';

describe('resolution-validation', () => {
  describe('validateEventResolution', () => {
    it('should pass validation for a valid event', () => {
      const event: Event = {
        id: 'event-1',
        name: 'Dragon Attack',
        eventType: 'combat',
        isCompleted: false,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should fail validation for already completed event', () => {
      const event: Event = {
        id: 'event-1',
        name: 'Dragon Attack',
        eventType: 'combat',
        isCompleted: true,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event has already been completed');
      expect(result.warnings).toEqual([]);
    });

    it('should fail validation for event with empty name', () => {
      const event: Event = {
        id: 'event-1',
        name: '',
        eventType: 'combat',
        isCompleted: false,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event must have a valid name');
      expect(result.warnings).toEqual([]);
    });

    it('should fail validation for event with whitespace-only name', () => {
      const event: Event = {
        id: 'event-1',
        name: '   ',
        eventType: 'combat',
        isCompleted: false,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event must have a valid name');
    });

    it('should warn for event without occurredAt', () => {
      const event: Event = {
        id: 'event-1',
        name: 'Dragon Attack',
        eventType: 'combat',
        isCompleted: false,
        occurredAt: null,
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toContain('Event has not yet occurred (occurredAt is not set)');
    });

    it('should fail with multiple errors', () => {
      const event: Event = {
        id: 'event-1',
        name: '',
        eventType: 'combat',
        isCompleted: true,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Event has already been completed');
      expect(result.errors).toContain('Event must have a valid name');
    });

    it('should fail with errors and warnings', () => {
      const event: Event = {
        id: 'event-1',
        name: '',
        eventType: 'combat',
        isCompleted: false,
        occurredAt: null,
        variables: {},
      };

      const result = validateEventResolution(event);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event must have a valid name');
      expect(result.warnings).toContain('Event has not yet occurred (occurredAt is not set)');
    });
  });

  describe('validateEncounterResolution', () => {
    it('should pass validation for a valid encounter', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: 3,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should fail validation for already resolved encounter', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: 3,
        isResolved: true,
        resolvedAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Encounter has already been resolved');
      expect(result.warnings).toEqual([]);
    });

    it('should fail validation for encounter with empty name', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: '',
        difficulty: 3,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Encounter must have a valid name');
      expect(result.warnings).toEqual([]);
    });

    it('should fail validation for encounter with whitespace-only name', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: '   ',
        difficulty: 3,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Encounter must have a valid name');
    });

    it('should warn for encounter without difficulty (null)', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: null,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toContain('Encounter does not have a difficulty rating set');
    });

    it('should warn for encounter without difficulty (undefined)', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: undefined,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toContain('Encounter does not have a difficulty rating set');
    });

    it('should NOT warn for encounter with difficulty 0', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Trivial Encounter',
        difficulty: 0,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).not.toContain('Encounter does not have a difficulty rating set');
    });

    it('should warn for encounter without scheduledAt', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: 3,
        isResolved: false,
        scheduledAt: null,
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toContain(
        'Encounter has not been scheduled (scheduledAt is not set)'
      );
    });

    it('should fail with multiple errors', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: '',
        difficulty: 3,
        isResolved: true,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain('Encounter has already been resolved');
      expect(result.errors).toContain('Encounter must have a valid name');
    });

    it('should fail with errors and multiple warnings', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: '',
        difficulty: null,
        isResolved: false,
        scheduledAt: null,
        variables: {},
      };

      const result = validateEncounterResolution(encounter);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Encounter must have a valid name');
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings).toContain('Encounter does not have a difficulty rating set');
      expect(result.warnings).toContain(
        'Encounter has not been scheduled (scheduledAt is not set)'
      );
    });
  });

  describe('validateResolution', () => {
    it('should validate an event when entityType is "event"', () => {
      const event: Event = {
        id: 'event-1',
        name: 'Dragon Attack',
        eventType: 'combat',
        isCompleted: false,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateResolution(event, 'event');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate an encounter when entityType is "encounter"', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: 3,
        isResolved: false,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateResolution(encounter, 'encounter');

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for completed event', () => {
      const event: Event = {
        id: 'event-1',
        name: 'Dragon Attack',
        eventType: 'combat',
        isCompleted: true,
        occurredAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateResolution(event, 'event');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Event has already been completed');
    });

    it('should fail validation for resolved encounter', () => {
      const encounter: Encounter = {
        id: 'encounter-1',
        name: 'Goblin Ambush',
        difficulty: 3,
        isResolved: true,
        scheduledAt: '2024-06-15T10:00:00Z',
        variables: {},
      };

      const result = validateResolution(encounter, 'encounter');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Encounter has already been resolved');
    });
  });
});
