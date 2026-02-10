import { z } from 'zod';

export const OutboundMessageSchema = z.object({
  tenantId: z.string().uuid(),
  agentId: z.string().uuid(),
  platform: z.string().min(1),
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  text: z.string().min(1),
  threadId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type OutboundMessageDto = z.infer<typeof OutboundMessageSchema>;
