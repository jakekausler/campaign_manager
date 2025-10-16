import * as bcrypt from 'bcrypt';

// Common weak passwords list
const COMMON_PASSWORDS = [
  'password',
  'password1',
  'password123',
  'password1!',
  '12345678',
  'qwerty',
  'qwerty123',
  'welcome',
  'welcome1',
  'welcome1!',
  'admin',
  'admin123',
  'admin123!',
  'letmein',
  'letmein1',
  'letmein1!',
  'monkey',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
];

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates password strength according to requirements:
 * - At least 8 characters
 * - At least 1 symbol
 * - At least 1 number
 * - Not a common password
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for at least one symbol
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one symbol');
  }

  // Check against common passwords (case-insensitive)
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Hashes a password using bcrypt with 12 rounds
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Compares a plain text password with a hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
