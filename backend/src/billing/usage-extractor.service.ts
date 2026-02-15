import { Injectable, Logger } from '@nestjs/common';

/**
 * Normalized usage data from any LLM provider response.
 */
export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheReadTokens: number;
  provider: string;
  model: string;
}

/**
 * UsageExtractorService
 *
 * Provider-agnostic extraction of token usage from LLM API responses.
 * Supports: Anthropic, OpenAI, Google, Qwen, Kimi.
 */
@Injectable()
export class UsageExtractorService {
  private readonly logger = new Logger(UsageExtractorService.name);

  /**
   * Detect the provider from a model name string.
   * Returns lowercase provider key or 'unknown'.
   */
  detectProvider(model: string): string {
    if (!model) return 'unknown';
    const m = model.toLowerCase();

    if (m.includes('claude') || m.startsWith('anthropic/')) return 'anthropic';
    if (m.includes('gpt') || m.includes('o1') || m.includes('o3') || m.startsWith('openai/')) return 'openai';
    if (m.includes('gemini') || m.startsWith('google/')) return 'google';
    if (m.includes('qwen') || m.startsWith('qwen/')) return 'qwen';
    if (m.includes('kimi') || m.includes('moonshot') || m.startsWith('kimi/')) return 'kimi';

    return 'unknown';
  }

  /**
   * Extract normalized usage from a provider response object.
   * Returns null if no usage data can be extracted.
   */
  extractUsage(response: Record<string, unknown>, model: string): NormalizedUsage | null {
    if (!response) return null;

    const provider = this.detectProvider(model);
    const usage = response.usage as Record<string, unknown> | undefined;
    if (!usage) return null;

    try {
      switch (provider) {
        case 'anthropic':
          return this.extractAnthropic(usage, model);
        case 'openai':
          return this.extractOpenAI(usage, model);
        case 'google':
          return this.extractGoogle(usage, model);
        case 'qwen':
        case 'kimi':
          return this.extractOpenAICompatible(usage, model, provider);
        default:
          return this.extractGeneric(usage, model, provider);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to extract usage for model ${model}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Anthropic Responses API format:
   * usage: { input_tokens, output_tokens, cache_read_input_tokens?, thinking_tokens? }
   */
  private extractAnthropic(usage: Record<string, unknown>, model: string): NormalizedUsage {
    return {
      inputTokens: Number(usage.input_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? 0),
      thinkingTokens: Number(usage.thinking_tokens ?? 0),
      cacheReadTokens: Number(usage.cache_read_input_tokens ?? 0),
      provider: 'anthropic',
      model: this.normalizeModelName(model),
    };
  }

  /**
   * OpenAI Chat Completions format:
   * usage: { prompt_tokens, completion_tokens, total_tokens, completion_tokens_details?: { reasoning_tokens } }
   */
  private extractOpenAI(usage: Record<string, unknown>, model: string): NormalizedUsage {
    const details = usage.completion_tokens_details as Record<string, unknown> | undefined;
    return {
      inputTokens: Number(usage.prompt_tokens ?? 0),
      outputTokens: Number(usage.completion_tokens ?? 0),
      thinkingTokens: Number(details?.reasoning_tokens ?? 0),
      cacheReadTokens: 0,
      provider: 'openai',
      model: this.normalizeModelName(model),
    };
  }

  /**
   * Google Gemini format:
   * usage: { promptTokenCount, candidatesTokenCount, totalTokenCount, cachedContentTokenCount? }
   */
  private extractGoogle(usage: Record<string, unknown>, model: string): NormalizedUsage {
    return {
      inputTokens: Number(usage.promptTokenCount ?? 0),
      outputTokens: Number(usage.candidatesTokenCount ?? 0),
      thinkingTokens: 0,
      cacheReadTokens: Number(usage.cachedContentTokenCount ?? 0),
      provider: 'google',
      model: this.normalizeModelName(model),
    };
  }

  /**
   * OpenAI-compatible format (Qwen, Kimi, etc.)
   */
  private extractOpenAICompatible(
    usage: Record<string, unknown>,
    model: string,
    provider: string,
  ): NormalizedUsage {
    return {
      inputTokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
      outputTokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
      thinkingTokens: 0,
      cacheReadTokens: 0,
      provider,
      model: this.normalizeModelName(model),
    };
  }

  /**
   * Best-effort extraction for unknown providers.
   */
  private extractGeneric(
    usage: Record<string, unknown>,
    model: string,
    provider: string,
  ): NormalizedUsage {
    return {
      inputTokens: Number(usage.input_tokens ?? usage.prompt_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? usage.completion_tokens ?? 0),
      thinkingTokens: Number(usage.thinking_tokens ?? 0),
      cacheReadTokens: Number(usage.cache_read_input_tokens ?? 0),
      provider: provider || 'unknown',
      model: this.normalizeModelName(model),
    };
  }

  /**
   * Strip provider prefix from model name for storage.
   * e.g. "anthropic/claude-sonnet-4-5" → "claude-sonnet-4-5"
   */
  private normalizeModelName(model: string): string {
    const slashIdx = model.indexOf('/');
    return slashIdx >= 0 ? model.substring(slashIdx + 1) : model;
  }
}
