import { z } from 'zod';

/**
 * Update Routing DTO - PATCH /api/dashboard/channels/:id/routing/:ruleId
 *
 * Partial update for an existing routing rule.
 * All fields are optional; only provided fields are updated.
 */
export const updateRoutingSchema = z.object({
  sourceIdentifier: z
    .string()
    .min(1, 'sourceIdentifier must not be empty')
    .max(200, 'sourceIdentifier must be at most 200 characters')
    .optional(),
  agentId: z.string().uuid('agentId must be a valid UUID').optional(),
  priority: z
    .number()
    .int('priority must be an integer')
    .min(0, 'priority must be at least 0')
    .max(100, 'priority must be at most 100')
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateRoutingDto = z.infer<typeof updateRoutingSchema>;
