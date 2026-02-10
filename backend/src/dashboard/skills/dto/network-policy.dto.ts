import { z } from 'zod';

export const validateDomainSchema = z.object({
  domain: z.string().min(1).max(253),
  agentId: z.string().uuid().optional(),
});

export type ValidateDomainDto = z.infer<typeof validateDomainSchema>;
