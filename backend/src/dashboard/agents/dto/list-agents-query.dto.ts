import { z } from 'zod';

/**
 * List Agents Query DTO - GET /api/dashboard/agents
 * Matches API Contract v1.2.0 Section 6: Tenant: Agents - List Agents
 *
 * Query parameters for filtering and sorting agents.
 */
export const listAgentsQuerySchema = z.object({
  status: z
    .enum(['active', 'idle', 'error'], {
      error: 'Status must be one of: active, idle, error',
    })
    .optional(),
  role: z
    .enum(['pm', 'engineering', 'operations', 'custom'], {
      error: 'Role must be one of: pm, engineering, operations, custom',
    })
    .optional(),
  sort: z
    .enum([
      'name:asc',
      'name:desc',
      'last_active:asc',
      'last_active:desc',
      'created_at:asc',
      'created_at:desc',
    ], {
      error:
        'Sort must be one of: name:asc, name:desc, last_active:asc, last_active:desc, created_at:asc, created_at:desc',
    })
    .optional(),
});

export type ListAgentsQueryDto = z.infer<typeof listAgentsQuerySchema>;
