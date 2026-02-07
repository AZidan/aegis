import { z } from 'zod';

/**
 * Refresh Token DTO - POST /api/auth/refresh
 * Matches API Contract v1.1.0 Section 1: Refresh Token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

/**
 * Logout DTO - POST /api/auth/logout
 * Matches API Contract v1.1.0 Section 1: Logout
 */
export const logoutSchema = z.object({
  refreshToken: z
    .string({ error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});

export type LogoutDto = z.infer<typeof logoutSchema>;
