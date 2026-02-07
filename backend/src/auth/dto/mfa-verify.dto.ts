import { z } from 'zod';

/**
 * MFA Verify DTO - POST /api/auth/mfa/verify
 * Matches API Contract v1.1.0 Section 1: MFA Verification
 */
export const mfaVerifySchema = z.object({
  email: z.string({ error: 'Email is required' }).email('Invalid email format'),
  totpCode: z
    .string({ error: 'TOTP code is required' })
    .length(6, 'TOTP code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'TOTP code must be 6 digits'),
});

export type MfaVerifyDto = z.infer<typeof mfaVerifySchema>;
