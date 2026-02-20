import { z } from 'zod';

export const githubImportSchema = z.object({
  url: z.string().url().refine(
    (u) => /github\.com/.test(u),
    'Must be a GitHub URL',
  ),
});

export type GitHubImportDto = z.infer<typeof githubImportSchema>;
