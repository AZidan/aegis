import { z } from 'zod';

/**
 * List Tenants Query DTO - GET /api/admin/tenants
 * Matches API Contract v1.1.0 Section 3: Platform Admin: Tenants
 *
 * All fields optional with sensible defaults.
 * Query params arrive as strings, so we coerce numeric fields.
 */
export const listTenantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(['active', 'suspended', 'provisioning', 'failed'])
    .optional(),
  plan: z.enum(['starter', 'growth', 'enterprise']).optional(),
  health: z.enum(['healthy', 'degraded', 'down']).optional(),
  search: z.string().optional(),
  include: z.enum(['health', 'agents', 'all']).optional(),
  sort: z
    .enum([
      'company_name:asc',
      'company_name:desc',
      'created_at:asc',
      'created_at:desc',
      'agent_count:asc',
      'agent_count:desc',
    ])
    .optional(),
});

export type ListTenantsQueryDto = z.infer<typeof listTenantsQuerySchema>;
