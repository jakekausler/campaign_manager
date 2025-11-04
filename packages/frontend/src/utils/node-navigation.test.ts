import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  getNodeEditRoute,
  getNodeTypeLabel,
  isNodeEditable,
  getNodeEditMessage,
} from './node-navigation';

afterEach(() => {
  vi.clearAllMocks();
});

describe('node-navigation', () => {
  describe('getNodeEditRoute', () => {
    const campaignId = 'campaign-123';

    it('should return route for VARIABLE node type', () => {
      const route = getNodeEditRoute('VARIABLE', 'var-456', campaignId);
      expect(route).toBe('/variables/var-456');
    });

    it('should return route for CONDITION node type', () => {
      const route = getNodeEditRoute('CONDITION', 'cond-789', campaignId);
      expect(route).toBe('/conditions/cond-789');
    });

    it('should return route for EFFECT node type', () => {
      const route = getNodeEditRoute('EFFECT', 'eff-321', campaignId);
      expect(route).toBe('/effects/eff-321');
    });

    it('should return route for ENTITY node type', () => {
      const route = getNodeEditRoute('ENTITY', 'ent-654', campaignId);
      expect(route).toBe('/entities/ent-654');
    });

    it('should replace :id placeholder with actual entity ID', () => {
      const route = getNodeEditRoute('VARIABLE', 'my-special-id-123', campaignId);
      expect(route).toContain('my-special-id-123');
      expect(route).not.toContain(':id');
    });

    it('should handle entity IDs with special characters', () => {
      const entityId = 'entity-with-dashes-and_underscores';
      const route = getNodeEditRoute('CONDITION', entityId, campaignId);
      expect(route).toBe(`/conditions/${entityId}`);
    });
  });

  describe('getNodeTypeLabel', () => {
    it('should return "Variable" for VARIABLE type', () => {
      expect(getNodeTypeLabel('VARIABLE')).toBe('Variable');
    });

    it('should return "Condition" for CONDITION type', () => {
      expect(getNodeTypeLabel('CONDITION')).toBe('Condition');
    });

    it('should return "Effect" for EFFECT type', () => {
      expect(getNodeTypeLabel('EFFECT')).toBe('Effect');
    });

    it('should return "Entity" for ENTITY type', () => {
      expect(getNodeTypeLabel('ENTITY')).toBe('Entity');
    });

    it('should return "Unknown" for unrecognized type', () => {
      // @ts-expect-error - Testing invalid type
      expect(getNodeTypeLabel('INVALID_TYPE')).toBe('Unknown');
    });
  });

  describe('isNodeEditable', () => {
    it('should return false for VARIABLE (not implemented yet)', () => {
      expect(isNodeEditable('VARIABLE')).toBe(false);
    });

    it('should return false for CONDITION (not implemented yet)', () => {
      expect(isNodeEditable('CONDITION')).toBe(false);
    });

    it('should return false for EFFECT (not implemented yet)', () => {
      expect(isNodeEditable('EFFECT')).toBe(false);
    });

    it('should return false for ENTITY (not implemented yet)', () => {
      expect(isNodeEditable('ENTITY')).toBe(false);
    });

    it('should be easily updated when edit pages are implemented', () => {
      // This test documents the current behavior.
      // When edit pages are implemented, update isNodeEditable() function
      // and this test should fail, prompting you to update these assertions.
      const allTypes = ['VARIABLE', 'CONDITION', 'EFFECT', 'ENTITY'] as const;
      const editableCounts = allTypes.filter((type) => isNodeEditable(type)).length;

      // Currently no types are editable
      expect(editableCounts).toBe(0);

      // Future: When implementing edit pages, update isNodeEditable() and change this to:
      // expect(editableCounts).toBeGreaterThan(0);
    });
  });

  describe('getNodeEditMessage', () => {
    const entityId = 'entity-123';
    const label = 'Test Node';

    describe('when node is not editable', () => {
      it('should return "not yet implemented" message for VARIABLE', () => {
        const message = getNodeEditMessage('VARIABLE', entityId, label);
        expect(message).toContain('Variable editing not yet implemented');
        expect(message).toContain(label);
        expect(message).toContain(entityId);
      });

      it('should return "not yet implemented" message for CONDITION', () => {
        const message = getNodeEditMessage('CONDITION', entityId, label);
        expect(message).toContain('Condition editing not yet implemented');
        expect(message).toContain(label);
        expect(message).toContain(entityId);
      });

      it('should return "not yet implemented" message for EFFECT', () => {
        const message = getNodeEditMessage('EFFECT', entityId, label);
        expect(message).toContain('Effect editing not yet implemented');
        expect(message).toContain(label);
        expect(message).toContain(entityId);
      });

      it('should return "not yet implemented" message for ENTITY', () => {
        const message = getNodeEditMessage('ENTITY', entityId, label);
        expect(message).toContain('Entity editing not yet implemented');
        expect(message).toContain(label);
        expect(message).toContain(entityId);
      });

      it('should include node label in message', () => {
        const customLabel = 'My Custom Variable';
        const message = getNodeEditMessage('VARIABLE', entityId, customLabel);
        expect(message).toContain(customLabel);
      });

      it('should include entity ID in message', () => {
        const customId = 'very-specific-id-456';
        const message = getNodeEditMessage('CONDITION', customId, label);
        expect(message).toContain(customId);
      });

      it('should mention future update in message', () => {
        const message = getNodeEditMessage('EFFECT', entityId, label);
        expect(message).toContain('future update');
      });
    });

    describe('when node is editable (future implementation)', () => {
      // These tests will become relevant when edit pages are implemented
      // and isNodeEditable() starts returning true for some types

      it('should return "Opening" message when editing is supported', () => {
        // This test documents expected future behavior
        // When isNodeEditable() returns true, getNodeEditMessage should return:
        // "Opening Variable: Test Node" (or similar)

        // For now, we can only test the current "not implemented" behavior
        const message = getNodeEditMessage('VARIABLE', entityId, label);
        expect(message).toContain('not yet implemented');

        // Future: When edit pages are ready, this should change to:
        // expect(message).toBe('Opening Variable: Test Node');
      });
    });
  });

  describe('integration scenarios', () => {
    it('should provide consistent type labels across all functions', () => {
      const types = ['VARIABLE', 'CONDITION', 'EFFECT', 'ENTITY'] as const;

      types.forEach((type) => {
        const label = getNodeTypeLabel(type);
        const message = getNodeEditMessage(type, 'id', 'name');

        // Message should contain the same label that getNodeTypeLabel returns
        expect(message).toContain(label);
      });
    });

    it('should handle complete navigation flow for VARIABLE', () => {
      const nodeType = 'VARIABLE';
      const entityId = 'var-999';
      const label = 'Player Gold';
      const campaignId = 'campaign-abc';

      // Step 1: Get human-readable label
      const typeLabel = getNodeTypeLabel(nodeType);
      expect(typeLabel).toBe('Variable');

      // Step 2: Check if editable
      const editable = isNodeEditable(nodeType);
      expect(editable).toBe(false); // Not implemented yet

      // Step 3: Get appropriate message
      const message = getNodeEditMessage(nodeType, entityId, label);
      expect(message).toContain('not yet implemented');

      // Step 4: Get route (even though not yet navigable)
      const route = getNodeEditRoute(nodeType, entityId, campaignId);
      expect(route).toBe('/variables/var-999');
    });

    it('should handle complete navigation flow for CONDITION', () => {
      const nodeType = 'CONDITION';
      const entityId = 'cond-888';
      const label = 'Has Enough Gold';
      const campaignId = 'campaign-xyz';

      const typeLabel = getNodeTypeLabel(nodeType);
      expect(typeLabel).toBe('Condition');

      const editable = isNodeEditable(nodeType);
      expect(editable).toBe(false);

      const message = getNodeEditMessage(nodeType, entityId, label);
      expect(message).toContain('Condition editing not yet implemented');

      const route = getNodeEditRoute(nodeType, entityId, campaignId);
      expect(route).toBe('/conditions/cond-888');
    });
  });
});
