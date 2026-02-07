import { z } from 'zod';

/**
 * Update Tool Policy DTO - PUT /api/dashboard/agents/:id/tool-policy
 *
 * Request body for updating an agent's tool policy.
 * Both allow and deny are arrays of tool category IDs
 * referencing TOOL_CATEGORIES from tool-categories.ts.
 */
export const updateToolPolicySchema = z.object({
  allow: z
    .array(z.string(), { message: 'allow must be an array of strings' })
    .min(0),
  deny: z
    .array(z.string(), { message: 'deny must be an array of strings' })
    .optional()
    .default([]),
});

export type UpdateToolPolicyDto = z.infer<typeof updateToolPolicySchema>;
