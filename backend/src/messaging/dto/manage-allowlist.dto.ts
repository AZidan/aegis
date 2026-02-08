import { z } from 'zod';

/**
 * Manage Allowlist DTO - PUT /api/agents/:agentId/allowlist
 *
 * Accepts a batch of allowlist entries to replace or merge into the
 * agent's current communication allowlist. Each entry specifies a
 * peer agent and the permitted communication direction.
 */
export const manageAllowlistSchema = z.object({
  entries: z
    .array(
      z.object({
        allowedAgentId: z
          .string()
          .uuid('allowedAgentId must be a valid UUID'),
        direction: z.enum(['both', 'send_only', 'receive_only'], {
          error:
            'direction must be one of: both, send_only, receive_only',
        }),
      }),
    )
    .min(1, 'At least one allowlist entry is required'),
});

export type ManageAllowlistDto = z.infer<typeof manageAllowlistSchema>;
