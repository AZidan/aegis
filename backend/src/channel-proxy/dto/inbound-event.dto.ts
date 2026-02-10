import { z } from 'zod';

export const InboundEventSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().optional(),
  userId: z.string().optional(),
  userName: z.string().optional(),
  text: z.string().min(1),
  slashCommand: z.string().optional(),
  threadId: z.string().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
  rawEvent: z.record(z.string(), z.unknown()).optional(),
});

export type InboundEventDto = z.infer<typeof InboundEventSchema>;
