/**
 * WebSocket message event types and payloads for real-time message streaming.
 *
 * Events are emitted by:
 * - MessagingService.sendMessage() → 'message_sent'
 * - MessagingProcessor.process()   → 'message_delivered' / 'message_failed'
 *
 * Events are tenant-scoped: emitted only to the `tenant:{tenantId}:messages` room.
 * Payload intentionally excludes message body (client fetches via REST if needed).
 */

export type WsMessageEventType =
  | 'message_sent'
  | 'message_delivered'
  | 'message_failed';

export interface WsMessageEventData {
  messageId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  type: string; // MessageType enum value
  timestamp: string; // ISO 8601
  correlationId?: string | null;
}

export interface WsMessageEvent {
  type: WsMessageEventType;
  data: WsMessageEventData;
}
