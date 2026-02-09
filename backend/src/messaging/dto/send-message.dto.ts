import { z } from 'zod';
import { MAX_PAYLOAD_SIZE } from '../messaging.constants';

/**
 * Send Message DTO - POST /api/agents/:agentId/messages
 *
 * Validates outbound agent-to-agent messages.
 * The sender is derived from the route param; only the recipient and
 * message metadata are provided in the request body.
 */
export const sendMessageSchema = z.object({
  recipientId: z.string().uuid('recipientId must be a valid UUID'),
  type: z.enum(
    [
      'task_handoff',
      'status_update',
      'data_request',
      'data_response',
      'escalation',
      'notification',
    ],
    {
      error: 'type must be one of: task_handoff, status_update, data_request, data_response, escalation, notification',
    },
  ),
  payload: z
    .record(z.string(), z.unknown())
    .refine((val) => JSON.stringify(val).length <= MAX_PAYLOAD_SIZE, {
      message: `Payload must not exceed ${MAX_PAYLOAD_SIZE} bytes`,
    }),
  correlationId: z
    .string()
    .uuid('correlationId must be a valid UUID')
    .optional(),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
