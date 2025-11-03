import { BadRequestException } from '@nestjs/common';

import { LevelValidator, DEFAULT_LEVEL_RANGES } from './level-validator';

describe('LevelValidator', () => {
  describe('validateLevel', () => {
    describe('party levels', () => {
      it('should accept valid party level within default range (1-20)', () => {
        expect(() => LevelValidator.validateLevel(1, 'party')).not.toThrow();
        expect(() => LevelValidator.validateLevel(10, 'party')).not.toThrow();
        expect(() => LevelValidator.validateLevel(20, 'party')).not.toThrow();
      });

      it('should reject party level below minimum', () => {
        expect(() => LevelValidator.validateLevel(0, 'party')).toThrow(BadRequestException);
        expect(() => LevelValidator.validateLevel(-1, 'party')).toThrow(BadRequestException);
      });

      it('should reject party level above maximum', () => {
        expect(() => LevelValidator.validateLevel(21, 'party')).toThrow(BadRequestException);
        expect(() => LevelValidator.validateLevel(100, 'party')).toThrow(BadRequestException);
      });

      it('should provide descriptive error message for out of range party level', () => {
        try {
          LevelValidator.validateLevel(25, 'party');
          fail('Expected BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain(
            'Party level must be between 1 and 20'
          );
          expect((error as BadRequestException).message).toContain('received 25');
        }
      });
    });

    describe('kingdom levels', () => {
      it('should accept valid kingdom level within default range (1-10)', () => {
        expect(() => LevelValidator.validateLevel(1, 'kingdom')).not.toThrow();
        expect(() => LevelValidator.validateLevel(5, 'kingdom')).not.toThrow();
        expect(() => LevelValidator.validateLevel(10, 'kingdom')).not.toThrow();
      });

      it('should reject kingdom level below minimum', () => {
        expect(() => LevelValidator.validateLevel(0, 'kingdom')).toThrow(BadRequestException);
      });

      it('should reject kingdom level above maximum', () => {
        expect(() => LevelValidator.validateLevel(11, 'kingdom')).toThrow(BadRequestException);
      });

      it('should provide descriptive error message for out of range kingdom level', () => {
        try {
          LevelValidator.validateLevel(15, 'kingdom');
          fail('Expected BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain(
            'Kingdom level must be between 1 and 10'
          );
          expect((error as BadRequestException).message).toContain('received 15');
        }
      });
    });

    describe('settlement levels', () => {
      it('should accept valid settlement level within default range (1-10)', () => {
        expect(() => LevelValidator.validateLevel(1, 'settlement')).not.toThrow();
        expect(() => LevelValidator.validateLevel(5, 'settlement')).not.toThrow();
        expect(() => LevelValidator.validateLevel(10, 'settlement')).not.toThrow();
      });

      it('should reject settlement level below minimum', () => {
        expect(() => LevelValidator.validateLevel(0, 'settlement')).toThrow(BadRequestException);
      });

      it('should reject settlement level above maximum', () => {
        expect(() => LevelValidator.validateLevel(11, 'settlement')).toThrow(BadRequestException);
      });
    });

    describe('structure levels', () => {
      it('should accept valid structure level within default range (1-5)', () => {
        expect(() => LevelValidator.validateLevel(1, 'structure')).not.toThrow();
        expect(() => LevelValidator.validateLevel(3, 'structure')).not.toThrow();
        expect(() => LevelValidator.validateLevel(5, 'structure')).not.toThrow();
      });

      it('should reject structure level below minimum', () => {
        expect(() => LevelValidator.validateLevel(0, 'structure')).toThrow(BadRequestException);
      });

      it('should reject structure level above maximum', () => {
        expect(() => LevelValidator.validateLevel(6, 'structure')).toThrow(BadRequestException);
      });
    });

    describe('character levels', () => {
      it('should accept valid character level within default range (1-20)', () => {
        expect(() => LevelValidator.validateLevel(1, 'character')).not.toThrow();
        expect(() => LevelValidator.validateLevel(10, 'character')).not.toThrow();
        expect(() => LevelValidator.validateLevel(20, 'character')).not.toThrow();
      });

      it('should reject character level below minimum', () => {
        expect(() => LevelValidator.validateLevel(0, 'character')).toThrow(BadRequestException);
      });

      it('should reject character level above maximum', () => {
        expect(() => LevelValidator.validateLevel(21, 'character')).toThrow(BadRequestException);
      });
    });

    describe('type validation', () => {
      it('should reject non-number values', () => {
        expect(() => LevelValidator.validateLevel('5' as unknown as number, 'party')).toThrow(
          BadRequestException
        );
        expect(() => LevelValidator.validateLevel(null as unknown as number, 'party')).toThrow(
          BadRequestException
        );
        expect(() => LevelValidator.validateLevel(undefined as unknown as number, 'party')).toThrow(
          BadRequestException
        );
      });

      it('should reject NaN', () => {
        expect(() => LevelValidator.validateLevel(NaN, 'party')).toThrow(BadRequestException);
      });

      it('should reject non-integer numbers', () => {
        expect(() => LevelValidator.validateLevel(5.5, 'party')).toThrow(BadRequestException);
        expect(() => LevelValidator.validateLevel(1.1, 'kingdom')).toThrow(BadRequestException);
      });

      it('should provide descriptive error for non-number type', () => {
        try {
          LevelValidator.validateLevel('invalid' as unknown as number, 'party');
          fail('Expected BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain('Level must be a valid number');
        }
      });

      it('should provide descriptive error for non-integer', () => {
        try {
          LevelValidator.validateLevel(3.7, 'party');
          fail('Expected BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain('Level must be an integer');
        }
      });
    });

    describe('custom ranges', () => {
      it('should accept custom minimum', () => {
        expect(() => LevelValidator.validateLevel(5, 'party', { min: 5 })).not.toThrow();
        expect(() => LevelValidator.validateLevel(4, 'party', { min: 5 })).toThrow(
          BadRequestException
        );
      });

      it('should accept custom maximum', () => {
        expect(() => LevelValidator.validateLevel(30, 'party', { max: 30 })).not.toThrow();
        expect(() => LevelValidator.validateLevel(31, 'party', { max: 30 })).toThrow(
          BadRequestException
        );
      });

      it('should accept both custom min and max', () => {
        const customRange = { min: 10, max: 15 };
        expect(() => LevelValidator.validateLevel(10, 'party', customRange)).not.toThrow();
        expect(() => LevelValidator.validateLevel(12, 'party', customRange)).not.toThrow();
        expect(() => LevelValidator.validateLevel(15, 'party', customRange)).not.toThrow();
        expect(() => LevelValidator.validateLevel(9, 'party', customRange)).toThrow(
          BadRequestException
        );
        expect(() => LevelValidator.validateLevel(16, 'party', customRange)).toThrow(
          BadRequestException
        );
      });

      it('should use custom range in error message', () => {
        try {
          LevelValidator.validateLevel(50, 'kingdom', { max: 20 });
          fail('Expected BadRequestException');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).message).toContain(
            'Kingdom level must be between 1 and 20'
          );
        }
      });
    });
  });

  describe('validate', () => {
    it('should return the validated level value', () => {
      expect(LevelValidator.validate(5, 'party')).toBe(5);
      expect(LevelValidator.validate(10, 'kingdom')).toBe(10);
      expect(LevelValidator.validate(1, 'settlement')).toBe(1);
    });

    it('should throw on invalid level', () => {
      expect(() => LevelValidator.validate(25, 'party')).toThrow(BadRequestException);
    });
  });

  describe('getRange', () => {
    it('should return default range for party', () => {
      const range = LevelValidator.getRange('party');
      expect(range).toEqual({ min: 1, max: 20, entityType: 'party' });
    });

    it('should return default range for kingdom', () => {
      const range = LevelValidator.getRange('kingdom');
      expect(range).toEqual({ min: 1, max: 10, entityType: 'kingdom' });
    });

    it('should return default range for settlement', () => {
      const range = LevelValidator.getRange('settlement');
      expect(range).toEqual({ min: 1, max: 10, entityType: 'settlement' });
    });

    it('should return default range for structure', () => {
      const range = LevelValidator.getRange('structure');
      expect(range).toEqual({ min: 1, max: 5, entityType: 'structure' });
    });

    it('should merge custom range with defaults', () => {
      const range = LevelValidator.getRange('party', { max: 30 });
      expect(range).toEqual({ min: 1, max: 30, entityType: 'party' });
    });
  });

  describe('DEFAULT_LEVEL_RANGES', () => {
    it('should define ranges for all entity types', () => {
      expect(DEFAULT_LEVEL_RANGES.party).toBeDefined();
      expect(DEFAULT_LEVEL_RANGES.character).toBeDefined();
      expect(DEFAULT_LEVEL_RANGES.kingdom).toBeDefined();
      expect(DEFAULT_LEVEL_RANGES.settlement).toBeDefined();
      expect(DEFAULT_LEVEL_RANGES.structure).toBeDefined();
    });

    it('should have valid min < max for all ranges', () => {
      Object.values(DEFAULT_LEVEL_RANGES).forEach((range) => {
        expect(range.min).toBeLessThan(range.max);
        expect(range.min).toBeGreaterThan(0);
      });
    });
  });
});
