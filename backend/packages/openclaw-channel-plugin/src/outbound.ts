import { OutboundPayload, PluginConfig } from './types';

/**
 * Default configuration values for outbound delivery.
 */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/**
 * OutboundHandler
 *
 * Sends agent responses from OpenClaw back to the Aegis channel proxy
 * via HTTP POST. The proxy then delivers the message to the target platform.
 *
 * Features:
 * - Per-tenant bearer token authentication
 * - Exponential backoff retry (configurable, default 3 attempts)
 * - Request timeout protection
 * - Structured error reporting
 *
 * Design notes:
 * - Each tenant has its own proxy bearer token (no cross-tenant leakage)
 * - The proxy endpoint is /api/channels/deliver (POST)
 * - Retries use exponential backoff: baseDelay * 2^attempt (with jitter)
 */
export class OutboundHandler {
  private readonly proxyBaseUrl: string;
  private readonly bearerToken: string;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly requestTimeoutMs: number;

  constructor(config: PluginConfig) {
    this.proxyBaseUrl = config.proxyBaseUrl.replace(/\/+$/, '');
    this.bearerToken = config.proxyBearerToken;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  /**
   * Send an outbound payload to the Aegis channel proxy.
   *
   * Performs HTTP POST with:
   * - Bearer token authentication
   * - JSON content type
   * - Exponential backoff retry on transient failures (5xx, network errors)
   * - Timeout protection
   *
   * @param payload - The outbound message payload
   * @returns The HTTP status code from a successful delivery
   * @throws Error if all retry attempts are exhausted
   */
  async send(payload: OutboundPayload): Promise<number> {
    const url = `${this.proxyBaseUrl}/api/channels/deliver`;
    const body = JSON.stringify(payload);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const status = await this.doPost(url, body);

        // 2xx = success, return immediately
        if (status >= 200 && status < 300) {
          return status;
        }

        // 4xx = client error, do not retry (bad request, auth failure, etc.)
        if (status >= 400 && status < 500) {
          throw new Error(
            `Outbound delivery failed with client error: HTTP ${status}`,
          );
        }

        // 5xx = server error, retry with backoff
        lastError = new Error(
          `Outbound delivery failed with server error: HTTP ${status}`,
        );
      } catch (err) {
        lastError =
          err instanceof Error ? err : new Error(String(err));

        // Do not retry client errors (re-thrown above)
        if (lastError.message.includes('client error')) {
          throw lastError;
        }
      }

      // Wait before next retry (exponential backoff with jitter)
      if (attempt < this.maxRetries - 1) {
        const delay = this.calculateBackoffDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw new Error(
      `Outbound delivery exhausted all ${this.maxRetries} retry attempts. Last error: ${lastError?.message ?? 'unknown'}`,
    );
  }

  /**
   * Perform the HTTP POST request to the proxy.
   *
   * Uses the native `fetch` API (available in Node 18+).
   * Returns the HTTP status code.
   */
  private async doPost(url: string, body: string): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body,
        signal: controller.signal,
      });

      return response.status;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(
          `Outbound delivery timed out after ${this.requestTimeoutMs}ms`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Calculate exponential backoff delay with jitter.
   * Formula: baseDelay * 2^attempt + random(0, baseDelay/2)
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = this.retryBaseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * (this.retryBaseDelayMs / 2);
    return exponentialDelay + jitter;
  }

  /**
   * Sleep for the specified number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
