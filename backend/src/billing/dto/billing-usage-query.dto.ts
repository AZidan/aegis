import { z } from 'zod';

export const billingUsageQuerySchema = z.object({
  period: z.enum(['current', 'previous']).default('current'),
  agentId: z.string().uuid().optional(),
});

export type BillingUsageQueryDto = z.infer<typeof billingUsageQuerySchema>;
