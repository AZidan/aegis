import { z } from 'zod';

export const queryAlertSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  resolved: z.preprocess(
    (val) => (val === 'true' ? true : val === 'false' ? false : val),
    z.boolean().optional(),
  ),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type QueryAlertDto = z.infer<typeof queryAlertSchema>;
