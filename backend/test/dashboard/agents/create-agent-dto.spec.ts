import { createAgentSchema } from '../../../src/dashboard/agents/dto/create-agent.dto';

/**
 * CreateAgentDto Validation Tests
 *
 * Tests the Zod validation schema for the Create Agent endpoint
 * (POST /api/dashboard/agents) as specified in API Contract v1.2.0 Section 6.
 */
describe('CreateAgentDto (Zod Schema)', () => {
  // ============================================================
  // Valid payloads
  // ============================================================
  describe('valid payloads', () => {
    const validBase = {
      name: 'Project Manager Bot',
      role: 'pm' as const,
      modelTier: 'sonnet' as const,
      thinkingMode: 'low' as const,
      toolPolicy: { allow: ['web_search', 'code_exec'] },
    };

    it('should accept minimal required fields', () => {
      const result = createAgentSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('should accept all optional fields', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        description: 'Manages project tasks and sprints',
        assistedUserId: '550e8400-e29b-41d4-a716-446655440000',
        assistedUserRole: 'product_manager',
        channel: {
          type: 'telegram',
          token: 'bot123456:ABC-DEF1234ghIkl',
          chatId: '-1001234567890',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept name at exactly 3 characters', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        name: 'Bot',
      });

      expect(result.success).toBe(true);
    });

    it('should accept name at exactly 50 characters', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        name: 'A'.repeat(50),
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid role values', () => {
      const roles = ['pm', 'engineering', 'operations', 'custom'] as const;
      for (const role of roles) {
        const result = createAgentSchema.safeParse({ ...validBase, role });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid modelTier values', () => {
      const tiers = ['haiku', 'sonnet', 'opus'] as const;
      for (const modelTier of tiers) {
        const result = createAgentSchema.safeParse({ ...validBase, modelTier });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid thinkingMode values', () => {
      const modes = ['off', 'low', 'high'] as const;
      for (const thinkingMode of modes) {
        const result = createAgentSchema.safeParse({
          ...validBase,
          thinkingMode,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept toolPolicy with only allow array', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        toolPolicy: { allow: ['web_search'] },
      });

      expect(result.success).toBe(true);
    });

    it('should accept toolPolicy with allow and deny arrays', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        toolPolicy: {
          allow: ['web_search', 'code_exec'],
          deny: ['file_delete'],
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept empty allow array in toolPolicy', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        toolPolicy: { allow: [] },
      });

      expect(result.success).toBe(true);
    });

    it('should accept telegram channel binding', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        channel: {
          type: 'telegram',
          token: 'bot-token-123',
          chatId: '-1001234567890',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept slack channel binding', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        channel: {
          type: 'slack',
          workspaceId: 'T01234567',
          channelId: 'C01234567',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept channel with type only (no credentials)', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        channel: {
          type: 'telegram',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept without optional description', () => {
      const { description, ...withoutDescription } = {
        ...validBase,
        description: undefined,
      };
      const result = createAgentSchema.safeParse(withoutDescription);
      expect(result.success).toBe(true);
    });

    it('should accept without optional channel', () => {
      const result = createAgentSchema.safeParse(validBase);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channel).toBeUndefined();
      }
    });

    it('should accept without optional assistedUserId and assistedUserRole', () => {
      const result = createAgentSchema.safeParse(validBase);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assistedUserId).toBeUndefined();
        expect(result.data.assistedUserRole).toBeUndefined();
      }
    });
  });

  // ============================================================
  // Invalid payloads
  // ============================================================
  describe('invalid payloads', () => {
    const validBase = {
      name: 'Project Manager Bot',
      role: 'pm' as const,
      modelTier: 'sonnet' as const,
      thinkingMode: 'low' as const,
      toolPolicy: { allow: ['web_search'] },
    };

    it('should reject missing name', () => {
      const { name, ...withoutName } = validBase;
      const result = createAgentSchema.safeParse(withoutName);
      expect(result.success).toBe(false);
    });

    it('should reject name shorter than 3 characters', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        name: 'AB',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 50 characters', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        name: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing role', () => {
      const { role, ...withoutRole } = validBase;
      const result = createAgentSchema.safeParse(withoutRole);
      expect(result.success).toBe(false);
    });

    it('should reject invalid role value', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        role: 'invalid_role',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing modelTier', () => {
      const { modelTier, ...withoutModelTier } = validBase;
      const result = createAgentSchema.safeParse(withoutModelTier);
      expect(result.success).toBe(false);
    });

    it('should reject invalid modelTier value', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        modelTier: 'gpt-4',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing thinkingMode', () => {
      const { thinkingMode, ...withoutThinkingMode } = validBase;
      const result = createAgentSchema.safeParse(withoutThinkingMode);
      expect(result.success).toBe(false);
    });

    it('should reject invalid thinkingMode value', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        thinkingMode: 'medium',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing toolPolicy', () => {
      const { toolPolicy, ...withoutToolPolicy } = validBase;
      const result = createAgentSchema.safeParse(withoutToolPolicy);
      expect(result.success).toBe(false);
    });

    it('should reject toolPolicy without allow array', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        toolPolicy: { deny: ['file_delete'] },
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid channel type', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        channel: { type: 'discord' },
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid assistedUserId (not a UUID)', () => {
      const result = createAgentSchema.safeParse({
        ...validBase,
        assistedUserId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    it('should reject completely empty body', () => {
      const result = createAgentSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
