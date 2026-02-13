export interface InboundPlatformEvent {
  platform: string;
  workspaceId: string;
  channelId?: string;
  userId?: string;
  userName?: string;
  text: string;
  slashCommand?: string;
  threadId?: string;
  timestamp: string;
  rawEvent?: Record<string, unknown>;
}

export interface OutboundAgentMessage {
  tenantId: string;
  agentId: string;
  platform: string;
  workspaceId: string;
  channelId: string;
  text: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionContext {
  sessionId: string;
  tenantId: string;
  agentId: string;
  platform: string;
  workspaceId: string;
  channelId?: string;
  userId?: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface ForwardToContainerJob {
  sessionContext: SessionContext;
  event: InboundPlatformEvent;
  containerUrl: string;
  agentModelTier?: string;
}

export interface DispatchToPlatformJob {
  message: OutboundAgentMessage;
  connectionId: string;
  credentials: Record<string, unknown>;
}
