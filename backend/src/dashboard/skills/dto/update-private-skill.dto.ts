import { z } from 'zod';

export const updatePrivateSkillSchema = z.object({
  description: z.string().min(10).max(500).optional(),
  sourceCode: z.string().min(1).max(100000).optional(),
  permissions: z.object({
    network: z.object({ allowedDomains: z.array(z.string()) }),
    files: z.object({ readPaths: z.array(z.string()), writePaths: z.array(z.string()) }),
    env: z.object({ required: z.array(z.string()), optional: z.array(z.string()) }),
  }).optional(),
  documentation: z.string().max(50000).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export type UpdatePrivateSkillDto = z.infer<typeof updatePrivateSkillSchema>;
