import { installSkillSchema } from '../../../src/dashboard/skills/dto/install-skill.dto';

// ---------------------------------------------------------------------------
// Test Suite: InstallSkillDto (Zod schema validation)
// ---------------------------------------------------------------------------
describe('installSkillSchema', () => {
  // =========================================================================
  // Valid cases
  // =========================================================================
  describe('valid inputs', () => {
    it('should accept agentId as valid UUID', () => {
      const result = installSkillSchema.parse({
        agentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      });

      expect(result.agentId).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
      expect(result.credentials).toBeUndefined();
    });

    it('should accept agentId with credentials as Record<string, string>', () => {
      const input = {
        agentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        credentials: {
          apiKey: 'sk-1234567890',
          secretToken: 'tok_abc',
        },
      };

      const result = installSkillSchema.parse(input);

      expect(result.agentId).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
      expect(result.credentials).toEqual({
        apiKey: 'sk-1234567890',
        secretToken: 'tok_abc',
      });
    });

    it('should accept without credentials (optional)', () => {
      const result = installSkillSchema.parse({
        agentId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      });

      expect(result.credentials).toBeUndefined();
    });

    it('should accept empty credentials object', () => {
      const result = installSkillSchema.parse({
        agentId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        credentials: {},
      });

      expect(result.credentials).toEqual({});
    });

    it('should accept credentials with single entry', () => {
      const result = installSkillSchema.parse({
        agentId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        credentials: { apiKey: 'my-key' },
      });

      expect(result.credentials).toEqual({ apiKey: 'my-key' });
    });
  });

  // =========================================================================
  // Invalid cases
  // =========================================================================
  describe('invalid inputs', () => {
    it('should reject missing agentId', () => {
      expect(() =>
        installSkillSchema.parse({}),
      ).toThrow();
    });

    it('should reject empty object', () => {
      expect(() =>
        installSkillSchema.parse({}),
      ).toThrow();
    });

    it('should reject agentId that is not a UUID', () => {
      expect(() =>
        installSkillSchema.parse({ agentId: 'not-a-uuid' }),
      ).toThrow();
    });

    it('should reject agentId as empty string', () => {
      expect(() =>
        installSkillSchema.parse({ agentId: '' }),
      ).toThrow();
    });

    it('should reject agentId as number', () => {
      expect(() =>
        installSkillSchema.parse({ agentId: 12345 }),
      ).toThrow();
    });

    it('should reject non-string credential values (number)', () => {
      expect(() =>
        installSkillSchema.parse({
          agentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          credentials: { apiKey: 12345 },
        }),
      ).toThrow();
    });

    it('should reject non-string credential values (boolean)', () => {
      expect(() =>
        installSkillSchema.parse({
          agentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          credentials: { enabled: true },
        }),
      ).toThrow();
    });

    it('should reject non-string credential values (nested object)', () => {
      expect(() =>
        installSkillSchema.parse({
          agentId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          credentials: { config: { nested: 'value' } },
        }),
      ).toThrow();
    });

    it('should include UUID error message for invalid agentId', () => {
      try {
        installSkillSchema.parse({ agentId: 'not-a-uuid' });
        fail('Expected validation error');
      } catch (error: unknown) {
        const zodError = error as { issues: Array<{ message: string }> };
        const messages = zodError.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('UUID'))).toBe(true);
      }
    });
  });
});
