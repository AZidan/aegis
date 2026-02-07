import { z } from 'zod';

/**
 * Authentication form validation schemas
 * Zod v4 runtime validation for react-hook-form integration
 */

// Login form schema
export const loginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Register form schema with cross-field password confirmation
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(50, 'Name must be less than 50 characters'),
    email: z.string().email('Invalid email address').min(1, 'Email is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one number')
      .regex(
        /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
        'Must contain at least one special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: 'You must accept the terms of service',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// MFA 6-digit TOTP code schema
export const mfaVerifySchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Code must contain only digits'),
});

export type MfaVerifyFormData = z.infer<typeof mfaVerifySchema>;

// MFA backup code schema
export const mfaBackupCodeSchema = z.object({
  backupCode: z
    .string()
    .min(1, 'Backup code is required')
    .regex(/^[a-zA-Z0-9-]+$/, 'Invalid backup code format'),
});

export type MfaBackupCodeFormData = z.infer<typeof mfaBackupCodeSchema>;

/**
 * Password strength calculator
 * Returns a score from 0-4 with descriptive label and Tailwind color class
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) {
    return { score: 0, label: '', color: '' };
  }

  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) score += 1;

  const normalizedScore = Math.min(4, Math.floor(score * (4 / 6)));

  const labels: Record<number, { label: string; color: string }> = {
    0: { label: 'Very weak', color: 'bg-red-500' },
    1: { label: 'Weak', color: 'bg-orange-500' },
    2: { label: 'Fair', color: 'bg-yellow-500' },
    3: { label: 'Strong', color: 'bg-blue-500' },
    4: { label: 'Very strong', color: 'bg-green-500' },
  };

  const result = labels[normalizedScore] ?? { label: 'Very weak', color: 'bg-red-500' };
  return { score: normalizedScore, ...result };
}
