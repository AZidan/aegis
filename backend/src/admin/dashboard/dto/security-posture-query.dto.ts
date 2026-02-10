import { z } from 'zod';

export const securityPostureQuerySchema = z.object({
  timeRange: z.enum(['24h', '7d', '30d', '90d']).optional().default('30d'),
});

export type SecurityPostureQueryDto = z.infer<typeof securityPostureQuerySchema>;
