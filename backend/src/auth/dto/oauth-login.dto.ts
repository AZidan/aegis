import { z } from 'zod';

/**
 * OAuth Login DTO - POST /api/auth/login/oauth
 * Matches API Contract v1.1.0 Section 1: OAuth Login
 */
export const oauthLoginSchema = z.object({
  provider: z.enum(['google', 'github'], {
    error: 'Provider must be google or github',
  }),
  code: z
    .string({ error: 'OAuth authorization code is required' })
    .min(1, 'OAuth authorization code is required'),
  redirectUri: z
    .string({ error: 'Redirect URI is required' })
    .url('Redirect URI must be a valid URL'),
});

export type OAuthLoginDto = z.infer<typeof oauthLoginSchema>;
