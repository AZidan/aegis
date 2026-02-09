import { z } from 'zod';

/**
 * Create Routing DTO - POST /api/dashboard/channels/:id/routing
 *
 * Validates creation of a new routing rule that maps a platform event
 * (slash command, channel, user, or tenant default) to a specific agent.
 */
export const createRoutingSchema = z.object({
  routeType: z.enum(
    ['slash_command', 'channel_mapping', 'user_mapping', 'tenant_default'],
    {
      error:
        'routeType must be one of: slash_command, channel_mapping, user_mapping, tenant_default',
    },
  ),
  sourceIdentifier: z
    .string()
    .min(1, 'sourceIdentifier must not be empty')
    .max(200, 'sourceIdentifier must be at most 200 characters'),
  agentId: z.string().uuid('agentId must be a valid UUID'),
  priority: z
    .number()
    .int('priority must be an integer')
    .min(0, 'priority must be at least 0')
    .max(100, 'priority must be at most 100')
    .optional()
    .default(0),
  isActive: z.boolean().optional().default(true),
});

export type CreateRoutingDto = z.infer<typeof createRoutingSchema>;
