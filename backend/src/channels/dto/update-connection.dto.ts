import { z } from 'zod';

/**
 * Update Connection DTO - PATCH /api/dashboard/channels/:id
 *
 * Partial update for an existing channel connection.
 * All fields are optional; only provided fields are updated.
 */
export const updateConnectionSchema = z.object({
  workspaceName: z
    .string()
    .min(1, 'workspaceName must not be empty')
    .max(200, 'workspaceName must be at most 200 characters')
    .optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
  status: z
    .enum(['pending', 'active', 'disconnected', 'error'], {
      error:
        'status must be one of: pending, active, disconnected, error',
    })
    .optional(),
});

export type UpdateConnectionDto = z.infer<typeof updateConnectionSchema>;
