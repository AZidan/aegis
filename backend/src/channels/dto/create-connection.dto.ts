import { z } from 'zod';

/**
 * Create Connection DTO - POST /api/dashboard/channels
 *
 * Validates inbound requests to register a new channel platform connection.
 * Credentials are stored as encrypted JSON (OAuth tokens, bot tokens, etc.).
 */
export const createConnectionSchema = z.object({
  platform: z.enum(['SLACK', 'TEAMS', 'DISCORD', 'GOOGLE_CHAT'], {
    error:
      'platform must be one of: SLACK, TEAMS, DISCORD, GOOGLE_CHAT',
  }),
  workspaceId: z
    .string()
    .min(1, 'workspaceId must not be empty')
    .max(200, 'workspaceId must be at most 200 characters'),
  workspaceName: z
    .string()
    .min(1, 'workspaceName must not be empty')
    .max(200, 'workspaceName must be at most 200 characters'),
  credentials: z.record(z.string(), z.unknown()),
});

export type CreateConnectionDto = z.infer<typeof createConnectionSchema>;
