import { z } from 'zod';

/**
 * Update Agent DTO - PATCH /api/dashboard/agents/:id
 * Matches API Contract v1.2.0 Section 6: Tenant: Agents - Update Agent
 *
 * All fields are optional (partial update).
 */
export const updateAgentSchema = z.object({
  name: z
    .string()
    .min(3, 'Agent name must be at least 3 characters')
    .max(50, 'Agent name must be at most 50 characters')
    .optional(),
  description: z.string().optional(),
  modelTier: z
    .enum(['haiku', 'sonnet', 'opus'], {
      error: 'Model tier must be one of: haiku, sonnet, opus',
    })
    .optional(),
  thinkingMode: z
    .enum(['off', 'low', 'high'], {
      error: 'Thinking mode must be one of: off, low, high',
    })
    .optional(),
  toolPolicy: z
    .object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    })
    .optional(),
});

export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;
