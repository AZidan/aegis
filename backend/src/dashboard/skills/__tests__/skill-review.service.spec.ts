import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SkillReviewService } from '../skill-review.service';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('SkillReviewService', () => {
  let service: SkillReviewService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillReviewService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: string) => {
              if (key === 'ANTHROPIC_API_KEY') return 'test-api-key';
              if (key === 'ANTHROPIC_API_URL')
                return defaultVal ?? 'https://api.anthropic.com/v1/messages';
              return defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SkillReviewService>(SkillReviewService);
    configService = module.get<ConfigService>(ConfigService);
    jest.clearAllMocks();
  });

  const defaultParams = {
    sourceCode: 'export function run() { return "hello"; }',
    documentation: 'A simple skill',
    permissions: { network: { allowedDomains: [] } },
    compatibleRoles: ['engineering'],
  };

  describe('reviewSkill', () => {
    it('should return parsed review result on successful LLM call', async () => {
      const llmResponse = {
        riskScore: 15,
        findings: [
          {
            category: 'DATA_EXFILTRATION',
            severity: 'low',
            description: 'No data exfiltration detected',
            recommendation: 'None needed',
          },
        ],
        summary: 'Low risk skill with no security concerns.',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(llmResponse) }],
        }),
      });

      const result = await service.reviewSkill(defaultParams);

      expect(result.riskScore).toBe(15);
      expect(result.riskLevel).toBe('low');
      expect(result.findings).toHaveLength(1);
      expect(result.summary).toBe('Low risk skill with no security concerns.');
      expect(result.reviewedAt).toBeDefined();
    });

    it('should handle markdown-fenced JSON response', async () => {
      const fenced = '```json\n{"riskScore": 30, "findings": [], "summary": "OK"}\n```';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: fenced }],
        }),
      });

      const result = await service.reviewSkill(defaultParams);
      expect(result.riskScore).toBe(30);
      expect(result.riskLevel).toBe('medium');
    });

    it('should return medium risk on unparseable response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'This is not JSON at all' }],
        }),
      });

      const result = await service.reviewSkill(defaultParams);
      expect(result.riskScore).toBe(50);
      expect(result.riskLevel).toBe('medium');
    });

    it('should return medium risk on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const result = await service.reviewSkill(defaultParams);
      expect(result.riskScore).toBe(50);
      expect(result.riskLevel).toBe('medium');
      expect(result.findings[0].category).toBe('REVIEW_ERROR');
    });

    it('should return medium risk on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.reviewSkill(defaultParams);
      expect(result.riskScore).toBe(50);
      expect(result.riskLevel).toBe('medium');
    });

    it('should clamp riskScore to 0-100', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ riskScore: 150, findings: [], summary: 'Over' }),
            },
          ],
        }),
      });

      const result = await service.reviewSkill(defaultParams);
      expect(result.riskScore).toBe(100);
    });

    it('should map risk levels correctly', async () => {
      const testCases = [
        { score: 0, level: 'low' },
        { score: 25, level: 'low' },
        { score: 26, level: 'medium' },
        { score: 50, level: 'medium' },
        { score: 51, level: 'high' },
        { score: 75, level: 'high' },
        { score: 76, level: 'critical' },
        { score: 100, level: 'critical' },
      ];

      for (const { score, level } of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            content: [
              {
                type: 'text',
                text: JSON.stringify({ riskScore: score, findings: [], summary: 'test' }),
              },
            ],
          }),
        });

        const result = await service.reviewSkill(defaultParams);
        expect(result.riskLevel).toBe(level);
      }
    });

    it('should cross-reference script findings with permissions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                riskScore: 20,
                findings: [],
                summary: 'Low risk',
              }),
            },
          ],
        }),
      });

      const result = await service.reviewSkill({
        ...defaultParams,
        permissions: { network: { allowedDomains: [] } },
        scriptAnalysisFindings: ['fetch call detected at line 5'],
      });

      // Should bump to high because network call found without declared domains
      expect(result.findings.length).toBeGreaterThan(0);
      expect(
        result.findings.some((f) => f.category === 'UNAUTHORIZED_ACCESS'),
      ).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(51);
    });

    it('should send correct headers to Anthropic API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ riskScore: 10, findings: [], summary: 'ok' }),
            },
          ],
        }),
      });

      await service.reviewSkill(defaultParams);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should truncate long source code at 10000 chars', async () => {
      const longSource = 'x'.repeat(15000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [
            {
              type: 'text',
              text: JSON.stringify({ riskScore: 5, findings: [], summary: 'ok' }),
            },
          ],
        }),
      });

      await service.reviewSkill({ ...defaultParams, sourceCode: longSource });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[0].content;
      // The source is truncated before sending
      expect(userMessage.length).toBeLessThan(15000);
    });
  });

  describe('callAnthropicApi', () => {
    it('should throw if no API key configured', async () => {
      // Create a service with no API key
      const module = await Test.createTestingModule({
        providers: [
          SkillReviewService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ''),
            },
          },
        ],
      }).compile();

      const noKeyService = module.get<SkillReviewService>(SkillReviewService);
      await expect(noKeyService.callAnthropicApi('test')).rejects.toThrow(
        'ANTHROPIC_API_KEY not configured',
      );
    });
  });
});
