import { updateToolPolicySchema } from '../../../src/dashboard/agents/dto/update-tool-policy.dto';

/**
 * UpdateToolPolicyDto Validation Tests
 *
 * Tests the Zod validation schema for the Update Tool Policy endpoint
 * (PUT /api/dashboard/agents/:id/tool-policy) as specified in
 * API Contract v1.2.0 Section 6.
 *
 * Required: allow (string[])
 * Optional: deny (string[], defaults to [])
 */
describe('UpdateToolPolicyDto (Zod Schema)', () => {
  // ============================================================
  // Valid payloads
  // ============================================================
  describe('valid payloads', () => {
    it('should accept body with allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['analytics', 'web_search'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept body with both allow and deny arrays', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['analytics', 'web_search'],
        deny: ['devops', 'data_access'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: [],
      });
      expect(result.success).toBe(true);
    });

    it('should accept empty deny array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search'],
        deny: [],
      });
      expect(result.success).toBe(true);
    });

    it('should default deny to empty array when omitted', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deny).toEqual([]);
      }
    });

    it('should accept a single-element allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['communication'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept many elements in allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: [
          'analytics',
          'project_management',
          'code_management',
          'devops',
          'communication',
          'monitoring',
          'data_access',
          'web_search',
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should preserve the exact allow values provided', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search', 'analytics'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allow).toEqual(['web_search', 'analytics']);
      }
    });

    it('should preserve the exact deny values provided', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search'],
        deny: ['devops', 'data_access'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deny).toEqual(['devops', 'data_access']);
      }
    });
  });

  // ============================================================
  // Invalid payloads
  // ============================================================
  describe('invalid payloads', () => {
    it('should reject missing allow field', () => {
      const result = updateToolPolicySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject allow as a string instead of array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: 'web_search',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-string elements in allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: [123, 456],
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-string elements in deny array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search'],
        deny: [123],
      });
      expect(result.success).toBe(false);
    });

    it('should reject allow as null', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: null,
      });
      expect(result.success).toBe(false);
    });

    it('should reject allow as a number', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: 42,
      });
      expect(result.success).toBe(false);
    });

    it('should reject deny as a string instead of array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search'],
        deny: 'devops',
      });
      expect(result.success).toBe(false);
    });

    it('should reject boolean elements in allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: [true, false],
      });
      expect(result.success).toBe(false);
    });

    it('should reject mixed types in allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: ['web_search', 123, true],
      });
      expect(result.success).toBe(false);
    });

    it('should reject object elements in allow array', () => {
      const result = updateToolPolicySchema.safeParse({
        allow: [{ id: 'web_search' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
