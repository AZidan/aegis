import { z } from 'zod';

/**
 * Create Agent DTO - POST /api/dashboard/agents
 * Matches API Contract v1.2.0 Section 6: Tenant: Agents - Create Agent
 *
 * Required: name, role, modelTier, thinkingMode, toolPolicy
 * Optional: description, assistedUserId, assistedUserRole, channel
 */
export const createAgentSchema = z.object({
  // Step 1: Basic Info
  name: z
    .string({ error: 'Agent name is required' })
    .min(3, 'Agent name must be at least 3 characters')
    .max(50, 'Agent name must be at most 50 characters'),
  role: z.enum(['pm', 'engineering', 'operations', 'custom'], {
    error: 'Role must be one of: pm, engineering, operations, custom',
  }),
  description: z.string().optional(),
  assistedUserId: z.string().uuid('assistedUserId must be a valid UUID').optional(),
  assistedUserRole: z.string().optional(),

  // Step 2: Model Configuration
  modelTier: z.enum(['haiku', 'sonnet', 'opus'], {
    error: 'Model tier must be one of: haiku, sonnet, opus',
  }),
  thinkingMode: z.enum(['off', 'low', 'high'], {
    error: 'Thinking mode must be one of: off, low, high',
  }),

  // Step 3: Tool Policy
  toolPolicy: z.object({
    allow: z.array(z.string()),
    deny: z.array(z.string()).optional(),
  }),

  // Step 4: Channel Binding (optional)
  channel: z
    .object({
      type: z.enum(['telegram', 'slack'], {
        error: 'Channel type must be one of: telegram, slack',
      }),
      token: z.string().optional(),
      chatId: z.string().optional(),
      workspaceId: z.string().optional(),
      channelId: z.string().optional(),
    })
    .optional(),
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;
