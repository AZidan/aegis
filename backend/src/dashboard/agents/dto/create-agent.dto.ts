import { z } from 'zod';

/**
 * Create Agent DTO - POST /api/dashboard/agents
 * Matches API Contract v1.3.0 Section 6: Tenant: Agents - Create Agent
 *
 * Required: name, role, modelTier, thinkingMode, toolPolicy
 * Optional: description, assistedUserId, assistedUserRole, temperature, avatarColor, personality
 */
export const createAgentSchema = z.object({
  // Step 1: Basic Info
  name: z
    .string({ error: 'Agent name is required' })
    .min(3, 'Agent name must be at least 3 characters')
    .max(50, 'Agent name must be at most 50 characters'),
  role: z
    .string({ error: 'Role is required' })
    .min(1, 'Role must not be empty'),
  description: z.string().optional(),
  assistedUserId: z.string().uuid('assistedUserId must be a valid UUID').optional(),
  assistedUserRole: z.string().optional(),

  // Step 2: Model Configuration
  modelTier: z.enum(['haiku', 'sonnet', 'opus'], {
    error: 'Model tier must be one of: haiku, sonnet, opus',
  }),
  thinkingMode: z.enum(['fast', 'standard', 'extended'], {
    error: 'Thinking mode must be one of: fast, standard, extended',
  }),
  temperature: z.number().min(0).max(1).optional().default(0.3),
  avatarColor: z.string().optional().default('#6366f1'),
  personality: z.string().optional(),

  // Step 3: Tool Policy (allow-only)
  toolPolicy: z.object({
    allow: z.array(z.string()),
  }),

  // Step 1.5: Custom template overrides (optional)
  customTemplates: z.object({
    soulTemplate: z.string().optional(),
    agentsTemplate: z.string().optional(),
    heartbeatTemplate: z.string().optional(),
  }).optional(),
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;
