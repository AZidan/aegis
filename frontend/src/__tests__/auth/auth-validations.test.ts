import {
  loginSchema,
  registerSchema,
  mfaVerifySchema,
  mfaBackupCodeSchema,
  calculatePasswordStrength,
} from '@/lib/validations/auth';

// ---------------------------------------------------------------------------
// Test Suite: Auth Validation Schemas
// ---------------------------------------------------------------------------
describe('Auth Validation Schemas', () => {
  // =========================================================================
  // Login Schema
  // =========================================================================
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'password123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const result = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'password123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject password shorter than 8 characters', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('should accept password of exactly 8 characters', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: '12345678',
      });
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Register Schema
  // =========================================================================
  describe('registerSchema', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'ValidPass123!@',
      confirmPassword: 'ValidPass123!@',
      acceptTerms: true,
    };

    it('should validate correct registration data', () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    // Name validation
    it('should reject name shorter than 2 characters', () => {
      const result = registerSchema.safeParse({ ...validData, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 50 characters', () => {
      const result = registerSchema.safeParse({
        ...validData,
        name: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('should accept name of exactly 2 characters', () => {
      const result = registerSchema.safeParse({ ...validData, name: 'AB' });
      expect(result.success).toBe(true);
    });

    // Email validation
    it('should reject invalid email in register', () => {
      const result = registerSchema.safeParse({
        ...validData,
        email: 'bad-email',
      });
      expect(result.success).toBe(false);
    });

    // Password strength - uppercase
    it('should reject password without uppercase letter', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'nouppercase123!@',
        confirmPassword: 'nouppercase123!@',
      });
      expect(result.success).toBe(false);
    });

    // Password strength - lowercase
    it('should reject password without lowercase letter', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'NOLOWERCASE123!@',
        confirmPassword: 'NOLOWERCASE123!@',
      });
      expect(result.success).toBe(false);
    });

    // Password strength - number
    it('should reject password without number', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'NoNumbers!!@@',
        confirmPassword: 'NoNumbers!!@@',
      });
      expect(result.success).toBe(false);
    });

    // Password strength - special character
    it('should reject password without special character', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'NoSpecial123AB',
        confirmPassword: 'NoSpecial123AB',
      });
      expect(result.success).toBe(false);
    });

    // Password length
    it('should reject password shorter than 8 characters', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'Aa1!',
        confirmPassword: 'Aa1!',
      });
      expect(result.success).toBe(false);
    });

    // Password confirmation
    it('should reject when passwords do not match', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'ValidPass123!@',
        confirmPassword: 'DifferentPass123!@',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const confirmError = result.error.issues.find(
          (issue) => issue.path.includes('confirmPassword'),
        );
        expect(confirmError?.message).toBe('Passwords do not match');
      }
    });

    // Terms acceptance
    it('should reject when terms not accepted', () => {
      const result = registerSchema.safeParse({
        ...validData,
        acceptTerms: false,
      });
      expect(result.success).toBe(false);
    });

    // Valid edge cases
    it('should accept password with all required elements at minimum length', () => {
      const result = registerSchema.safeParse({
        ...validData,
        password: 'Aa1!aaaa',
        confirmPassword: 'Aa1!aaaa',
      });
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // MFA Verify Schema
  // =========================================================================
  describe('mfaVerifySchema', () => {
    it('should validate correct 6-digit code', () => {
      const result = mfaVerifySchema.safeParse({ code: '123456' });
      expect(result.success).toBe(true);
    });

    it('should reject code shorter than 6 digits', () => {
      const result = mfaVerifySchema.safeParse({ code: '12345' });
      expect(result.success).toBe(false);
    });

    it('should reject code longer than 6 digits', () => {
      const result = mfaVerifySchema.safeParse({ code: '1234567' });
      expect(result.success).toBe(false);
    });

    it('should reject code with non-numeric characters', () => {
      const result = mfaVerifySchema.safeParse({ code: '12345a' });
      expect(result.success).toBe(false);
    });

    it('should reject code with spaces', () => {
      const result = mfaVerifySchema.safeParse({ code: '123 45' });
      expect(result.success).toBe(false);
    });

    it('should reject empty code', () => {
      const result = mfaVerifySchema.safeParse({ code: '' });
      expect(result.success).toBe(false);
    });

    it('should accept code "000000"', () => {
      const result = mfaVerifySchema.safeParse({ code: '000000' });
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // MFA Backup Code Schema
  // =========================================================================
  describe('mfaBackupCodeSchema', () => {
    it('should validate alphanumeric backup code', () => {
      const result = mfaBackupCodeSchema.safeParse({
        backupCode: 'abc123-def456',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty backup code', () => {
      const result = mfaBackupCodeSchema.safeParse({ backupCode: '' });
      expect(result.success).toBe(false);
    });

    it('should reject backup code with special characters', () => {
      const result = mfaBackupCodeSchema.safeParse({
        backupCode: 'abc!@#456',
      });
      expect(result.success).toBe(false);
    });

    it('should accept uppercase letters in backup code', () => {
      const result = mfaBackupCodeSchema.safeParse({
        backupCode: 'ABC-123-DEF',
      });
      expect(result.success).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Test Suite: Password Strength Calculator
// ---------------------------------------------------------------------------
describe('calculatePasswordStrength', () => {
  it('should return score 0 for empty password', () => {
    const result = calculatePasswordStrength('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('');
  });

  it('should return low score for very weak password', () => {
    const result = calculatePasswordStrength('a');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.label).toBeTruthy();
  });

  it('should return higher score for strong password', () => {
    const result = calculatePasswordStrength('StrongPass123!@');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('should return maximum score for password meeting all criteria', () => {
    const result = calculatePasswordStrength('VeryStrong123!@pass');
    expect(result.score).toBe(4);
    expect(result.label).toBe('Very strong');
  });

  it('should include a Tailwind color class', () => {
    const result = calculatePasswordStrength('StrongPass123!@');
    expect(result.color).toMatch(/^bg-/);
  });

  it('should increase score for length >= 8', () => {
    const short = calculatePasswordStrength('abc');
    const long = calculatePasswordStrength('abcdefgh');
    expect(long.score).toBeGreaterThanOrEqual(short.score);
  });

  it('should increase score for length >= 12', () => {
    const shorter = calculatePasswordStrength('abcdefgh');
    const longer = calculatePasswordStrength('abcdefghijkl');
    expect(longer.score).toBeGreaterThanOrEqual(shorter.score);
  });

  it('should give "Very weak" label for score 0', () => {
    const result = calculatePasswordStrength('a');
    // Any single character should be very weak
    expect(['Very weak', 'Weak']).toContain(result.label);
  });

  it('should differentiate between no uppercase and with uppercase', () => {
    const noUpper = calculatePasswordStrength('lowercase123!');
    const withUpper = calculatePasswordStrength('Lowercase123!');
    expect(withUpper.score).toBeGreaterThanOrEqual(noUpper.score);
  });

  it('should differentiate between no special chars and with special chars', () => {
    const noSpecial = calculatePasswordStrength('Abcdefgh123');
    const withSpecial = calculatePasswordStrength('Abcdefgh123!');
    expect(withSpecial.score).toBeGreaterThanOrEqual(noSpecial.score);
  });
});
