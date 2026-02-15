import { z } from 'zod';

/**
 * Create Tenant DTO - POST /api/admin/tenants
 * Matches API Contract v1.2.0 Section 3: Platform Admin: Tenants
 *
 * Required: companyName, adminEmail, plan
 * Optional: industry, expectedAgentCount, companySize, deploymentRegion,
 *           notes, billingCycle, modelDefaults, resourceLimits
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
  companySize: z
    .enum(['1-10', '11-50', '51-200', '201-500', '500+'], {
      error: 'Company size must be one of: 1-10, 11-50, 51-200, 201-500, 500+',
    })
    .optional(),
  deploymentRegion: z
    .enum(
      [
        'us-east-1',
        'us-west-2',
        'eu-west-1',
        'eu-central-1',
        'ap-southeast-1',
        'ap-northeast-1',
      ],
      {
        error:
          'Deployment region must be one of: us-east-1, us-west-2, eu-west-1, eu-central-1, ap-southeast-1, ap-northeast-1',
      },
    )
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must be at most 500 characters')
    .optional(),
  billingCycle: z
    .enum(['monthly', 'annual'], {
      error: 'Billing cycle must be one of: monthly, annual',
    })
    .default('monthly')
    .optional(),
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
      cpuCores: z.number().positive().optional(),
      memoryMb: z.number().positive().optional(),
      diskGb: z.number().positive().optional(),
      maxAgents: z.number().int().positive().optional(),
      maxSkills: z.number().int().positive().optional(),
    })
    .optional(),
  overageBillingEnabled: z.boolean().optional(),
  monthlyTokenQuota: z.number().int().positive().optional(),
});

export type CreateTenantDto = z.infer<typeof createTenantSchema>;
