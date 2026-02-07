import { z } from 'zod';

/**
 * Create Tenant DTO - POST /api/admin/tenants
 * Matches API Contract v1.1.0 Section 3: Platform Admin: Tenants
 *
 * Required: companyName, adminEmail, plan
 * Optional: industry, expectedAgentCount, modelDefaults, resourceLimits
 */
export const createTenantSchema = z.object({
  companyName: z
    .string({ error: 'Company name is required' })
    .min(3, 'Company name must be at least 3 characters')
    .max(50, 'Company name must be at most 50 characters'),
  adminEmail: z
    .string({ error: 'Admin email is required' })
    .email('Invalid email format'),
  industry: z.string().optional(),
  expectedAgentCount: z.number().int().positive().optional(),
  plan: z.enum(['starter', 'growth', 'enterprise'], {
    error: 'Plan must be one of: starter, growth, enterprise',
  }),
  modelDefaults: z
    .object({
      tier: z.enum(['haiku', 'sonnet', 'opus']),
      thinkingMode: z.enum(['off', 'low', 'high']),
    })
    .optional(),
  resourceLimits: z
    .object({
      cpuCores: z.number().positive(),
      memoryMb: z.number().positive(),
      diskGb: z.number().positive(),
      maxAgents: z.number().int().positive(),
    })
    .optional(),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
