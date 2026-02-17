import { api } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageType =
  | 'task_handoff'
  | 'status_update'
  | 'data_request'
  | 'data_response'
  | 'escalation'
  | 'notification';

export type MessageStatus = 'pending' | 'delivered' | 'failed';

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  recipientName?: string;
  type: MessageType;
  payload: Record<string, unknown>;
  correlationId: string | null;
  status: MessageStatus;
  deliveredAt: string | null;
  createdAt: string;
}

export interface MessageListResponse {
  items: Message[];
  nextCursor: string | null;
}

export interface MessageStats {
  totalMessages: number;
  activeThreads: number;
  avgResponseTimeMs: number;
  failedMessages: number;
}

export interface MessageFilters {
  status?: MessageStatus;
  type?: MessageType;
  senderId?: string;
  recipientId?: string;
  correlationId?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

export async function fetchTenantMessages(
  filters?: MessageFilters,
): Promise<MessageListResponse> {
  const params = filters ? cleanParams(filters as unknown as Record<string, unknown>) : undefined;
  const { data } = await api.get<MessageListResponse>('/dashboard/messages', {
    params,
  });
  return data;
}

export async function fetchMessageStats(): Promise<MessageStats> {
  const { data } = await api.get<MessageStats>('/dashboard/messages/stats');
  return data;
}

export async function exportMessages(format: 'json' | 'csv'): Promise<void> {
  const response = await api.get('/dashboard/messages/export', {
    params: { format },
    responseType: 'blob',
  });

  const blob = response.data as Blob;
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `messages-${dateStr}.${format}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}
