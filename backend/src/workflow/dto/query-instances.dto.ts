import { z } from 'zod';

/**
 * Query Workflow Instances DTO
 * GET /api/dashboard/workflows/instances
 */
export const queryInstancesSchema = z.object({
  status: z
    .enum(['pending', 'running', 'completed', 'failed', 'timed_out'])
    .optional(),
  templateId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type QueryInstancesDto = z.infer<typeof queryInstancesSchema>;
