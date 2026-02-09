/**
 * @aegis/openclaw-channel-plugin
 *
 * OpenClaw plugin for Aegis channel integration. Bridges platform messages
 * (Slack, Teams, Discord, Google Chat) through the Aegis channel proxy.
 *
 * Architecture:
 *   Platform Webhook -> InboundHandler -> OpenClaw Pipeline -> Agent
 *   Agent Response -> OutboundHandler -> Aegis Channel Proxy -> Platform
 *
 * Usage:
 *   import { AegisChannelPlugin } from '@aegis/openclaw-channel-plugin';
 *
 *   const plugin = new AegisChannelPlugin({
 *     proxyBaseUrl: 'https://proxy.aegis.internal',
 *     proxyBearerToken: 'tenant-specific-token',
 *     maxRetries: 3,
 *     retryBaseDelayMs: 500,
 *     requestTimeoutMs: 10000,
 *   });
 *
 *   // Register with OpenClaw
 *   plugin.register(openclawInstance);
 */

import { InboundHandler } from './inbound';
import { OutboundHandler } from './outbound';
import {
  PluginConfig,
  InboundMessage,
  OutboundPayload,
  OutboundMetadata,
  ChannelPlatform,
  MessageType,
  TargetType,
  InboundHook,
  OutboundHook,
} from './types';

// Re-export all types for consumers
export {
  PluginConfig,
  InboundMessage,
  OutboundPayload,
  OutboundMetadata,
  ChannelPlatform,
  MessageType,
  TargetType,
  InboundHook,
  OutboundHook,
};

export { InboundHandler } from './inbound';
export { OutboundHandler } from './outbound';

/**
 * AegisChannelPlugin
 *
 * Main plugin class that wires together inbound and outbound handlers.
 * Designed to be registered with an OpenClaw instance as a plugin.
 *
 * The plugin provides two primary capabilities:
 * 1. Inbound: Receive platform webhook events, normalize, and forward to OpenClaw
 * 2. Outbound: Send agent responses back through the Aegis channel proxy
 */
export class AegisChannelPlugin {
  public readonly inbound: InboundHandler;
  public readonly outbound: OutboundHandler;

  private readonly config: PluginConfig;

  constructor(config: PluginConfig) {
    this.config = config;
    this.inbound = new InboundHandler();
    this.outbound = new OutboundHandler(config);
  }

  /**
   * Register the plugin with an OpenClaw instance.
   *
   * This method hooks into OpenClaw's lifecycle to:
   * - Listen for inbound platform messages (via registered hooks)
   * - Provide the outbound delivery capability to the agent pipeline
   *
   * @param openclaw - The OpenClaw instance to register with
   */
  register(openclaw: OpenClawInstance): void {
    // Register the inbound message handler
    if (openclaw.onInboundMessage) {
      openclaw.onInboundMessage(async (message: InboundMessage) => {
        await this.inbound.handleInbound(message);
      });
    }

    // Register the outbound delivery handler
    if (openclaw.onOutboundReady) {
      openclaw.onOutboundReady(async (payload: OutboundPayload) => {
        return this.outbound.send(payload);
      });
    }

    // Register plugin metadata
    if (openclaw.registerPlugin) {
      openclaw.registerPlugin({
        name: '@aegis/openclaw-channel-plugin',
        version: '0.1.0',
        capabilities: ['inbound-messages', 'outbound-delivery'],
      });
    }
  }

  /**
   * Register an additional inbound processing hook.
   * Useful for adding custom middleware (logging, rate limiting, etc.).
   */
  addInboundHook(hook: InboundHook): void {
    this.inbound.registerHook(hook);
  }

  /**
   * Send an outbound payload directly (bypassing the OpenClaw pipeline).
   * Useful for system notifications or error messages.
   */
  async sendDirect(payload: OutboundPayload): Promise<number> {
    return this.outbound.send(payload);
  }

  /**
   * Get the current plugin configuration (read-only).
   */
  getConfig(): Readonly<PluginConfig> {
    return Object.freeze({ ...this.config });
  }
}

/**
 * Minimal interface for the OpenClaw instance that this plugin integrates with.
 * This will be replaced by the actual OpenClaw SDK types once available.
 */
export interface OpenClawInstance {
  onInboundMessage?: (
    handler: (message: InboundMessage) => Promise<void>,
  ) => void;
  onOutboundReady?: (
    handler: (payload: OutboundPayload) => Promise<number>,
  ) => void;
  registerPlugin?: (meta: {
    name: string;
    version: string;
    capabilities: string[];
  }) => void;
}
