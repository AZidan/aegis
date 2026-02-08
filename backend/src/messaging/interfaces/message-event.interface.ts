/**
 * TypeScript interface for the BullMQ job payload in the agent-messages queue.
 *
 * Produced by MessagingService.sendMessage() and consumed by MessagingProcessor.
 * The processor persists the event to the agent_messages table and updates
 * delivery status accordingly.
 */
export interface MessageEventPayload {
  messageId: string;
  senderId: string;
  recipientId: string;
  type: string; // MessageType enum value
  payload: Record<string, unknown>;
  correlationId?: string | null;
}
