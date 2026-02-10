import { z } from 'zod';

export const submitPrivateSkillSchema = z.object({
  name: z.string().min(3).max(64).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Name must be kebab-case'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver'),
  description: z.string().min(10).max(500),
  category: z.enum(['productivity', 'communication', 'analytics', 'engineering', 'security', 'integration', 'custom']),
  compatibleRoles: z.array(z.string()).min(1),
  sourceCode: z.string().min(1).max(100000),
  permissions: z.object({
    network: z.object({ allowedDomains: z.array(z.string()) }),
    files: z.object({ readPaths: z.array(z.string()), writePaths: z.array(z.string()) }),
    env: z.object({ required: z.array(z.string()), optional: z.array(z.string()) }),
  }),
  documentation: z.string().max(50000).optional(),
});

export type SubmitPrivateSkillDto = z.infer<typeof submitPrivateSkillSchema>;
