import { updateAgentSchema } from '../../../src/dashboard/agents/dto/update-agent.dto';

/**
 * UpdateAgentDto Validation Tests
 *
 * Tests the Zod validation schema for the Update Agent endpoint
 * (PATCH /api/dashboard/agents/:id) as specified in API Contract v1.2.0 Section 6.
 *
 * All fields are optional (partial update).
 */
describe('UpdateAgentDto (Zod Schema)', () => {
  // ============================================================
  // Valid payloads
  // ============================================================
  describe('valid payloads', () => {
    it('should accept empty body (all fields optional)', () => {
      const result = updateAgentSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept name only', () => {
      const result = updateAgentSchema.safeParse({ name: 'Updated Bot' });
      expect(result.success).toBe(true);
    });

    it('should accept description only', () => {
      const result = updateAgentSchema.safeParse({
        description: 'Updated description',
      });
      expect(result.success).toBe(true);
    });

    it('should accept modelTier only', () => {
      const result = updateAgentSchema.safeParse({ modelTier: 'opus' });
      expect(result.success).toBe(true);
    });

    it('should accept thinkingMode only', () => {
      const result = updateAgentSchema.safeParse({ thinkingMode: 'high' });
      expect(result.success).toBe(true);
    });

    it('should accept toolPolicy only', () => {
      const result = updateAgentSchema.safeParse({
        toolPolicy: { allow: ['web_search'] },
      });
      expect(result.success).toBe(true);
    });

    it('should accept toolPolicy with deny only', () => {
      const result = updateAgentSchema.safeParse({
        toolPolicy: { deny: ['file_delete'] },
      });
      expect(result.success).toBe(true);
    });

    it('should accept toolPolicy with both allow and deny', () => {
      const result = updateAgentSchema.safeParse({
        toolPolicy: {
          allow: ['web_search', 'code_exec'],
          deny: ['file_delete'],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid fields together', () => {
      const result = updateAgentSchema.safeParse({
        name: 'Updated Bot',
        description: 'Updated description',
        modelTier: 'opus',
        thinkingMode: 'high',
        toolPolicy: {
          allow: ['web_search'],
          deny: ['file_delete'],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should accept all valid modelTier values', () => {
      const tiers = ['haiku', 'sonnet', 'opus'] as const;
      for (const modelTier of tiers) {
        const result = updateAgentSchema.safeParse({ modelTier });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid thinkingMode values', () => {
      const modes = ['off', 'low', 'high'] as const;
      for (const thinkingMode of modes) {
        const result = updateAgentSchema.safeParse({ thinkingMode });
        expect(result.success).toBe(true);
      }
    });

    it('should accept name at exactly 3 characters', () => {
      const result = updateAgentSchema.safeParse({ name: 'Bot' });
      expect(result.success).toBe(true);
    });

    it('should accept name at exactly 50 characters', () => {
      const result = updateAgentSchema.safeParse({ name: 'A'.repeat(50) });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // Invalid payloads
  // ============================================================
  describe('invalid payloads', () => {
    it('should reject name shorter than 3 characters', () => {
      const result = updateAgentSchema.safeParse({ name: 'AB' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 50 characters', () => {
      const result = updateAgentSchema.safeParse({ name: 'A'.repeat(51) });
      expect(result.success).toBe(false);
    });

    it('should reject invalid modelTier value', () => {
      const result = updateAgentSchema.safeParse({ modelTier: 'gpt-4' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid thinkingMode value', () => {
      const result = updateAgentSchema.safeParse({ thinkingMode: 'medium' });
      expect(result.success).toBe(false);
    });

    it('should reject non-string name', () => {
      const result = updateAgentSchema.safeParse({ name: 123 });
      expect(result.success).toBe(false);
    });

    it('should reject non-array toolPolicy.allow', () => {
      const result = updateAgentSchema.safeParse({
        toolPolicy: { allow: 'web_search' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-array toolPolicy.deny', () => {
      const result = updateAgentSchema.safeParse({
        toolPolicy: { deny: 'file_delete' },
      });
      expect(result.success).toBe(false);
    });
  });
});
