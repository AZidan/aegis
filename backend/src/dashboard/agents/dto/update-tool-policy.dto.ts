import { z } from 'zod';

/**
 * Update Tool Policy DTO - PUT /api/dashboard/agents/:id/tool-policy
 *
 * Request body for updating an agent's tool policy.
 * Allow-only model (no deny) per API Contract v1.3.0.
 */
export const updateToolPolicySchema = z.object({
  allow: z
    .array(z.string(), { message: 'allow must be an array of strings' })
    .min(0),
});

export type UpdateToolPolicyDto = z.infer<typeof updateToolPolicySchema>;
