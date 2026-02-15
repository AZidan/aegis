import { z } from 'zod';

/**
 * Accept Invite DTO - POST /api/auth/invite/:token/accept
 * API Contract Section 8: Team Management
 *
 * Supports two flows:
 * 1. Password-based: name + password
 * 2. OAuth-based: name + oauthProvider + oauthCode + redirectUri
 */
export const acceptInviteSchema = z
  .object({
    name: z
      .string({ error: 'Name is required' })
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or less'),
    password: z
      .string()
      .min(12, 'Password must be at least 12 characters')
      .optional(),
    oauthProvider: z.enum(['google', 'github']).optional(),
    oauthCode: z.string().optional(),
    redirectUri: z.string().url().optional(),
  })
  .refine(
    (data) =>
      data.password || (data.oauthProvider && data.oauthCode),
    {
      message:
        'Either password or OAuth credentials (oauthProvider + oauthCode) are required',
    },
  );

export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;
