import { z } from 'zod';

/**
 * Update Tenant Config DTO - PATCH /api/admin/tenants/:id
 * Matches API Contract v1.1.0 Section 3: Platform Admin: Tenants
 *
 * All fields optional - partial update of plan, resourceLimits, modelDefaults
 */
export const updateTenantSchema = z.object({
  plan: z.enum(['starter', 'growth', 'enterprise']).optional(),
  resourceLimits: z
    .object({
      cpuCores: z.number().positive().optional(),
      memoryMb: z.number().positive().optional(),
      diskGb: z.number().positive().optional(),
      maxAgents: z.number().int().positive().optional(),
    })
    .optional(),
  modelDefaults: z
    .object({
      tier: z.enum(['haiku', 'sonnet', 'opus']).optional(),
      thinkingMode: z.enum(['off', 'low', 'high']).optional(),
    })
    .optional(),
});

export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;
