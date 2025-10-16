import { hashPassword, comparePassword, validatePasswordStrength } from './password.util';

describe('Password Utilities', () => {
  describe('validatePasswordStrength', () => {
    it('should accept valid strong password', () => {
      const result = validatePasswordStrength('MyP@ssw0rd');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password less than 8 characters', () => {
      const result = validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without a number', () => {
      const result = validatePasswordStrength('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without a symbol', () => {
      const result = validatePasswordStrength('NoSymbols1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one symbol');
    });

    it('should reject common passwords', () => {
      const commonPasswords = ['Password1!', 'Welcome1!', 'Admin123!'];

      commonPasswords.forEach((password) => {
        const result = validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common');
      });
    });

    it('should accept password with all requirements', () => {
      const result = validatePasswordStrength('Str0ng!Pass');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'MyP@ssw0rd';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
    });

    it('should produce different hashes for same password (salt)', async () => {
      const password = 'MyP@ssw0rd';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'MyP@ssw0rd';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'MyP@ssw0rd';
      const wrongPassword = 'WrongP@ss1';
      const hash = await hashPassword(password);

      const result = await comparePassword(wrongPassword, hash);
      expect(result).toBe(false);
    });
  });
});
