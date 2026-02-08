import { z } from 'zod';

/**
 * Install Skill DTO
 * API Contract v1.3.0 Section 7.3 - Install Skill
 *
 * Request body for installing a skill onto a specific agent.
 * Optionally includes credentials if the skill requires them.
 */
export const installSkillSchema = z.object({
  agentId: z.string().uuid('agentId must be a valid UUID'),
  credentials: z.record(z.string(), z.string()).optional(),
});

export type InstallSkillDto = z.infer<typeof installSkillSchema>;
