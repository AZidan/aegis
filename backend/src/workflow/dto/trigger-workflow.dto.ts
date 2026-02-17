import { z } from 'zod';

/**
 * Trigger Workflow DTO
 * POST /api/dashboard/workflows/templates/:id/trigger
 */
export const triggerWorkflowSchema = z.object({
  agentIds: z
    .array(z.string().uuid('Each agentId must be a valid UUID'))
    .min(1, 'At least one agentId is required'),
  inputData: z.record(z.string(), z.unknown()).optional(),
});

export type TriggerWorkflowDto = z.infer<typeof triggerWorkflowSchema>;
