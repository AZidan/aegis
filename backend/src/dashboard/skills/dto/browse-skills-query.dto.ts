import { z } from 'zod';

/**
 * Browse Skills Query DTO
 * API Contract v1.3.0 Section 7.1 - Browse Skill Marketplace
 *
 * Query parameters for filtering, searching, paginating, and sorting
 * the skill marketplace catalog.
 */
export const browseSkillsQuerySchema = z.object({
  category: z
    .enum(['productivity', 'analytics', 'engineering', 'communication'])
    .optional(),
  role: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z
    .enum([
      'name:asc',
      'name:desc',
      'rating:desc',
      'install_count:desc',
      'created_at:desc',
    ])
    .optional(),
});

export type BrowseSkillsQueryDto = z.infer<typeof browseSkillsQuerySchema>;
