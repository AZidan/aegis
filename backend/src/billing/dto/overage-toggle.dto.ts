import { z } from 'zod';

export const overageToggleSchema = z.object({
  enabled: z.boolean(),
});

export type OverageToggleDto = z.infer<typeof overageToggleSchema>;
