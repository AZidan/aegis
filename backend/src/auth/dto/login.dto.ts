import { z } from 'zod';

/**
 * Login DTO - POST /api/auth/login
 * Matches API Contract v1.1.0 Section 1: Authentication & Authorization
 *
 * Password requirements from contract Security Notes:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const loginSchema = z.object({
  email: z.string({ error: 'Email is required' }).email('Invalid email format'),
  password: z
    .string({ error: 'Password is required' })
    .min(12, 'Password must be at least 12 characters'),
});

export type LoginDto = z.infer<typeof loginSchema>;
