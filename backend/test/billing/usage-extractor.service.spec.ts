import { Test, TestingModule } from '@nestjs/testing';
import {
  UsageExtractorService,
  NormalizedUsage,
} from '../../src/billing/usage-extractor.service';

// ---------------------------------------------------------------------------
// Test Suite: UsageExtractorService
// ---------------------------------------------------------------------------
describe('UsageExtractorService', () => {
  let service: UsageExtractorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsageExtractorService],
    }).compile();

    service = module.get<UsageExtractorService>(UsageExtractorService);
  });

  // =========================================================================
  // detectProvider
  // =========================================================================
  describe('detectProvider', () => {
    it('should detect anthropic from "anthropic/claude-sonnet-4-5"', () => {
      expect(service.detectProvider('anthropic/claude-sonnet-4-5')).toBe('anthropic');
    });

    it('should detect openai from "gpt-4o"', () => {
      expect(service.detectProvider('gpt-4o')).toBe('openai');
    });

    it('should detect google from "gemini-2.0-flash"', () => {
      expect(service.detectProvider('gemini-2.0-flash')).toBe('google');
    });

    it('should detect qwen from "qwen-plus"', () => {
      expect(service.detectProvider('qwen-plus')).toBe('qwen');
    });

    it('should detect kimi from "moonshot-v1"', () => {
      expect(service.detectProvider('moonshot-v1')).toBe('kimi');
    });
  });

  // =========================================================================
  // extractUsage
  // =========================================================================
  describe('extractUsage', () => {
    it('should extract Anthropic usage with input_tokens, output_tokens, and thinking_tokens', () => {
      const response = {
        usage: {
          input_tokens: 500,
          output_tokens: 200,
          thinking_tokens: 100,
          cache_read_input_tokens: 50,
        },
      };

      const result = service.extractUsage(response, 'anthropic/claude-sonnet-4-5');

      expect(result).toEqual<NormalizedUsage>({
        inputTokens: 500,
        outputTokens: 200,
        thinkingTokens: 100,
        cacheReadTokens: 50,
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
      });
    });

    it('should extract OpenAI usage with prompt_tokens, completion_tokens, and reasoning_tokens', () => {
      const response = {
        usage: {
          prompt_tokens: 300,
          completion_tokens: 150,
          total_tokens: 450,
          completion_tokens_details: {
            reasoning_tokens: 80,
          },
        },
      };

      const result = service.extractUsage(response, 'gpt-4o');

      expect(result).toEqual<NormalizedUsage>({
        inputTokens: 300,
        outputTokens: 150,
        thinkingTokens: 80,
        cacheReadTokens: 0,
        provider: 'openai',
        model: 'gpt-4o',
      });
    });

    it('should return null for null response', () => {
      const result = service.extractUsage(null as any, 'gpt-4o');

      expect(result).toBeNull();
    });
  });
});
