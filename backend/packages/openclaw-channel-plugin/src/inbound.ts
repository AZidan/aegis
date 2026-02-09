import { InboundMessage, InboundHook } from './types';

/**
 * InboundHandler
 *
 * Receives normalized inbound messages from platform webhook endpoints
 * and forwards them to the OpenClaw processing pipeline.
 *
 * The handler is designed to be registered as an OpenClaw plugin hook.
 * Platform-specific webhook adapters (Slack Events API, Teams Bot Framework,
 * Discord Gateway, Google Chat API) normalize their payloads into
 * `InboundMessage` format before calling `handleInbound()`.
 *
 * Design notes:
 * - Stateless: no in-memory state, all persistence is in the Aegis DB
 * - Idempotent: duplicate messages (same platformMessageId) are safe
 * - Async: returns immediately; OpenClaw pipeline handles processing
 */
export class InboundHandler {
  private hooks: InboundHook[] = [];

  /**
   * Register a hook that will be called for every inbound message.
   * Multiple hooks can be registered (e.g., logging, rate limiting, processing).
   */
  registerHook(hook: InboundHook): void {
    this.hooks.push(hook);
  }

  /**
   * Handle an inbound platform message.
   *
   * Validates the message structure, then invokes all registered hooks
   * sequentially. If any hook throws, the error is caught and logged
   * but does not prevent subsequent hooks from executing.
   *
   * @param message - Normalized inbound message from a platform webhook
   * @returns Object indicating success and any partial errors
   */
  async handleInbound(
    message: InboundMessage,
  ): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic structural validation
    if (!message.platformMessageId) {
      return { success: false, errors: ['Missing platformMessageId'] };
    }
    if (!message.platform) {
      return { success: false, errors: ['Missing platform'] };
    }
    if (!message.workspaceId) {
      return { success: false, errors: ['Missing workspaceId'] };
    }
    if (!message.channelId) {
      return { success: false, errors: ['Missing channelId'] };
    }
    if (!message.userId) {
      return { success: false, errors: ['Missing userId'] };
    }
    if (!message.text && message.messageType !== 'reaction' && message.messageType !== 'file_upload') {
      return { success: false, errors: ['Missing text for non-reaction/file message'] };
    }

    // Execute all registered hooks
    for (const hook of this.hooks) {
      try {
        await hook(message);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        errors.push(`Hook error: ${errorMsg}`);
        // Continue executing remaining hooks even if one fails
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Build a session key for conversation continuity.
   * Format: tenantId:channelId:threadId (or just tenantId:channelId if no thread)
   */
  static buildSessionKey(
    tenantId: string,
    channelId: string,
    threadId?: string,
  ): string {
    const parts = [tenantId, channelId];
    if (threadId) parts.push(threadId);
    return parts.join(':');
  }

  /**
   * Get the number of registered hooks (useful for health checks).
   */
  get hookCount(): number {
    return this.hooks.length;
  }
}
