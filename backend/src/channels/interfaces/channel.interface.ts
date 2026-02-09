/**
 * Channel Integration Interfaces
 *
 * Shared types for channel connection management, routing resolution,
 * and platform integration context.
 */

/**
 * Context provided by an inbound platform event for agent resolution.
 * The resolver walks these fields in priority order:
 *   1. slashCommand (highest)
 *   2. channelId
 *   3. userId
 *   4. tenant default (lowest)
 */
export interface RouteResolutionContext {
  /** Slash command name, e.g. "/ask-pm" */
  slashCommand?: string;
  /** Platform channel/room identifier */
  channelId?: string;
  /** Platform user identifier */
  userId?: string;
  /** Platform workspace identifier (must match a ChannelConnection.workspaceId) */
  workspaceId: string;
}

/**
 * Result of a successful agent resolution.
 */
export interface RouteResolutionResult {
  agentId: string;
  routeType: string;
  sourceIdentifier: string;
  priority: number;
}

/**
 * Supported channel platforms (mirrors ChannelPlatform enum).
 */
export type ChannelPlatformType = 'SLACK' | 'TEAMS' | 'DISCORD' | 'GOOGLE_CHAT';

/**
 * Supported connection statuses (mirrors ConnectionStatus enum).
 */
export type ConnectionStatusType = 'pending' | 'active' | 'disconnected' | 'error';

/**
 * Supported routing rule types (mirrors RouteType enum).
 */
export type RouteTypeValue = 'slash_command' | 'channel_mapping' | 'user_mapping' | 'tenant_default';

/**
 * Serialized connection response returned by the API.
 */
export interface ChannelConnectionResponse {
  id: string;
  tenantId: string;
  platform: ChannelPlatformType;
  workspaceId: string;
  workspaceName: string;
  status: ConnectionStatusType;
  connectedAt: string | null;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
  routingRuleCount?: number;
}

/**
 * Serialized routing rule response returned by the API.
 */
export interface ChannelRoutingResponse {
  id: string;
  connectionId: string;
  routeType: RouteTypeValue;
  sourceIdentifier: string;
  agentId: string;
  agentName?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
