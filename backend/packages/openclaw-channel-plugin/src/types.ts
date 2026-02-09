/**
 * Shared types for the Aegis OpenClaw Channel Plugin.
 *
 * These types define the message formats exchanged between platform
 * webhooks, the OpenClaw processing pipeline, and the Aegis channel proxy.
 */

// ---------------------------------------------------------------------------
// Platform / Channel Enums
// ---------------------------------------------------------------------------

export type ChannelPlatform = 'SLACK' | 'TEAMS' | 'DISCORD' | 'GOOGLE_CHAT';

export type MessageType =
  | 'text'
  | 'slash_command'
  | 'reaction'
  | 'file_upload'
  | 'interactive';

export type TargetType = 'channel' | 'thread' | 'direct_message';

// ---------------------------------------------------------------------------
// Inbound Message (Platform -> OpenClaw)
// ---------------------------------------------------------------------------

/**
 * Normalized inbound message received from a platform webhook.
 * The inbound handler transforms platform-specific payloads into this
 * canonical format before forwarding to OpenClaw for processing.
 */
export interface InboundMessage {
  /** Unique message ID from the platform */
  platformMessageId: string;

  /** Source platform identifier */
  platform: ChannelPlatform;

  /** Platform workspace/team ID (maps to ChannelConnection.workspaceId) */
  workspaceId: string;

  /** Platform channel/room ID where the message originated */
  channelId: string;

  /** Platform thread ID (for threaded conversations) */
  threadId?: string;

  /** Platform user ID of the message sender */
  userId: string;

  /** Display name of the sender (best-effort) */
  userName?: string;

  /** The message text content */
  text: string;

  /** Type of message */
  messageType: MessageType;

  /** Slash command name, if messageType is 'slash_command' */
  slashCommand?: string;

  /** Timestamp from the platform (ISO 8601) */
  platformTimestamp: string;

  /** Raw platform-specific payload for debugging / future extensibility */
  rawPayload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Outbound Payload (OpenClaw -> Aegis Proxy -> Platform)
// ---------------------------------------------------------------------------

/**
 * Outbound payload sent from OpenClaw (via the plugin) to the Aegis
 * channel proxy, which then delivers it to the target platform.
 */
export interface OutboundPayload {
  /** Aegis agent ID that generated this response */
  agentId: string;

  /** Session key for conversation continuity (tenantId:channelId:threadId) */
  sessionKey: string;

  /** Target delivery type */
  targetType: TargetType;

  /** Platform channel/room to deliver the response to */
  targetChannelId: string;

  /** Thread ID for threaded replies (omit to start a new thread or reply in-channel) */
  targetThreadId?: string;

  /** The response text content */
  text: string;

  /** Optional structured blocks/attachments (platform-specific) */
  blocks?: Record<string, unknown>[];

  /** Correlation ID linking back to the original inbound message */
  correlationId?: string;

  /** Metadata for the proxy layer */
  metadata: OutboundMetadata;
}

/**
 * Metadata attached to every outbound payload for the Aegis proxy.
 */
export interface OutboundMetadata {
  /** Aegis agent ID */
  agentId: string;

  /** Session key (tenantId:channelId:threadId) */
  sessionKey: string;

  /** Target delivery type */
  targetType: TargetType;

  /** Message type identifier */
  messageType: 'agent_response' | 'system_notification' | 'error';

  /** Platform to deliver to */
  platform: ChannelPlatform;

  /** Workspace ID on the platform */
  workspaceId: string;

  /** ISO 8601 timestamp when the response was generated */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Plugin Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the OpenClaw channel plugin.
 * Loaded from environment or passed at registration time.
 */
export interface PluginConfig {
  /** Base URL for the Aegis channel proxy API */
  proxyBaseUrl: string;

  /** Per-tenant bearer token for authenticating with the proxy */
  proxyBearerToken: string;

  /** Maximum retry attempts for outbound delivery */
  maxRetries: number;

  /** Base delay for exponential backoff (milliseconds) */
  retryBaseDelayMs: number;

  /** Request timeout for outbound HTTP calls (milliseconds) */
  requestTimeoutMs: number;
}

// ---------------------------------------------------------------------------
// Plugin Hooks
// ---------------------------------------------------------------------------

/**
 * Hook function signature for processing inbound messages.
 * Receives the normalized inbound message and returns void (fire-and-forget to OpenClaw).
 */
export type InboundHook = (message: InboundMessage) => Promise<void>;

/**
 * Hook function signature for sending outbound payloads.
 * Receives the outbound payload and returns the HTTP status from the proxy.
 */
export type OutboundHook = (payload: OutboundPayload) => Promise<number>;
