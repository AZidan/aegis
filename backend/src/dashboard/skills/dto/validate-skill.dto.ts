import { z } from 'zod';

export const validateSkillSchema = z.object({
  sourceCode: z.string().min(1).max(100000),
  dryRun: z.boolean().optional().default(false),
});

export type ValidateSkillDto = z.infer<typeof validateSkillSchema>;
