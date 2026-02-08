import { listAgentsQuerySchema } from '../../../src/dashboard/agents/dto/list-agents-query.dto';

/**
 * ListAgentsQueryDto Validation Tests
 *
 * Tests the Zod validation schema for the List Agents query parameters
 * (GET /api/dashboard/agents) as specified in API Contract v1.3.0 Section 6.
 *
 * v1.3.0 change: role is now a free-form string (not enum) since roles
 * are dynamic from the AgentRoleConfig table.
 */
describe('ListAgentsQueryDto (Zod Schema)', () => {
  // ============================================================
  // Valid payloads
  // ============================================================
  describe('valid payloads', () => {
    it('should accept empty query params', () => {
      const result = listAgentsQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept all valid status values', () => {
      const statuses = ['active', 'idle', 'error'] as const;
      for (const status of statuses) {
        const result = listAgentsQuerySchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should accept any string as role (dynamic roles)', () => {
      const roles = ['pm', 'engineering', 'operations', 'custom', 'support', 'data', 'hr', 'my_custom_role'];
      for (const role of roles) {
        const result = listAgentsQuerySchema.safeParse({ role });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid sort options', () => {
      const sortOptions = [
        'name:asc',
        'name:desc',
        'last_active:asc',
        'last_active:desc',
        'created_at:asc',
        'created_at:desc',
      ] as const;
      for (const sort of sortOptions) {
        const result = listAgentsQuerySchema.safeParse({ sort });
        expect(result.success).toBe(true);
      }
    });

    it('should accept status and role combined', () => {
      const result = listAgentsQuerySchema.safeParse({
        status: 'active',
        role: 'pm',
      });
      expect(result.success).toBe(true);
    });

    it('should accept all filters combined', () => {
      const result = listAgentsQuerySchema.safeParse({
        status: 'active',
        role: 'engineering',
        sort: 'name:asc',
      });
      expect(result.success).toBe(true);
    });

    it('should accept sort only', () => {
      const result = listAgentsQuerySchema.safeParse({
        sort: 'created_at:desc',
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // Invalid payloads
  // ============================================================
  describe('invalid payloads', () => {
    it('should reject invalid status value', () => {
      const result = listAgentsQuerySchema.safeParse({ status: 'running' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid sort value', () => {
      const result = listAgentsQuerySchema.safeParse({ sort: 'name' });
      expect(result.success).toBe(false);
    });

    it('should reject sort with invalid direction', () => {
      const result = listAgentsQuerySchema.safeParse({
        sort: 'name:ascending',
      });
      expect(result.success).toBe(false);
    });

    it('should reject sort with invalid field', () => {
      const result = listAgentsQuerySchema.safeParse({ sort: 'email:asc' });
      expect(result.success).toBe(false);
    });

    it('should reject paused as status (not in list query enum)', () => {
      const result = listAgentsQuerySchema.safeParse({ status: 'paused' });
      expect(result.success).toBe(false);
    });

    it('should reject provisioning as status', () => {
      const result = listAgentsQuerySchema.safeParse({
        status: 'provisioning',
      });
      expect(result.success).toBe(false);
    });
  });
});
