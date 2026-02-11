import { z } from 'zod';

/**
 * Create Agent Route DTO - POST /api/dashboard/agents/:id/channels/:connectionId/route
 *
 * Validates creation of a routing rule that maps a platform event
 * to this specific agent via a channel connection.
 */
export const createAgentRouteSchema = z.object({
  routeType: z.enum(
    ['slash_command', 'channel_mapping', 'user_mapping', 'tenant_default'],
    {
      error:
        'routeType must be one of: slash_command, channel_mapping, user_mapping, tenant_default',
    },
  ),
  sourceIdentifier: z
    .string()
    .min(1, 'sourceIdentifier must not be empty'),
  priority: z
    .number()
    .int('priority must be an integer')
    .min(0, 'priority must be at least 0')
    .max(100, 'priority must be at most 100')
    .optional(),
});

export type CreateAgentRouteDto = z.infer<typeof createAgentRouteSchema>;
