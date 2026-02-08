import { z } from 'zod';

/**
 * Update Agent DTO - PATCH /api/dashboard/agents/:id
 * Matches API Contract v1.3.0 Section 6: Tenant: Agents - Update Agent
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
    .enum(['fast', 'standard', 'extended'], {
      error: 'Thinking mode must be one of: fast, standard, extended',
    })
    .optional(),
  temperature: z.number().min(0).max(1).optional(),
  avatarColor: z.string().optional(),
  personality: z.string().optional(),
  toolPolicy: z
    .object({
      allow: z.array(z.string()).optional(),
    })
    .optional(),
});

export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;
