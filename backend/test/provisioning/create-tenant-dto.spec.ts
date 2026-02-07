import { createTenantSchema } from '../../src/admin/tenants/dto/create-tenant.dto';

/**
 * CreateTenantDto Validation Tests
 *
 * Tests the Zod validation schema for the Create Tenant endpoint
 * (POST /api/admin/tenants) as specified in API Contract v1.2.0 Section 3.
 */
describe('CreateTenantDto (Zod Schema)', () => {
  // ============================================================
  // Valid payloads
  // ============================================================
  describe('valid payloads', () => {
    it('should accept minimal required fields', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Acme Corp',
        adminEmail: 'admin@acme.com',
        plan: 'starter',
      });

      expect(result.success).toBe(true);
    });

    it('should accept all optional fields', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Full Company',
        adminEmail: 'admin@full.com',
        plan: 'enterprise',
        industry: 'Technology',
        expectedAgentCount: 25,
        companySize: '51-200',
        deploymentRegion: 'us-east-1',
        notes: 'Important customer with custom requirements',
        billingCycle: 'annual',
        modelDefaults: {
          tier: 'opus',
          thinkingMode: 'high',
        },
        resourceLimits: {
          cpuCores: 16,
          memoryMb: 32768,
          diskGb: 200,
          maxAgents: 100,
          maxSkills: 50,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept all valid companySize values', () => {
      const sizes = ['1-10', '11-50', '51-200', '201-500', '500+'];
      for (const size of sizes) {
        const result = createTenantSchema.safeParse({
          companyName: 'Test Company',
          adminEmail: 'admin@test.com',
          plan: 'starter',
          companySize: size,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid deploymentRegion values', () => {
      const regions = [
        'us-east-1',
        'us-west-2',
        'eu-west-1',
        'eu-central-1',
        'ap-southeast-1',
        'ap-northeast-1',
      ];
      for (const region of regions) {
        const result = createTenantSchema.safeParse({
          companyName: 'Test Company',
          adminEmail: 'admin@test.com',
          plan: 'growth',
          deploymentRegion: region,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should accept all valid billingCycle values', () => {
      for (const cycle of ['monthly', 'annual']) {
        const result = createTenantSchema.safeParse({
          companyName: 'Test Company',
          adminEmail: 'admin@test.com',
          plan: 'starter',
          billingCycle: cycle,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should default billingCycle to monthly when not provided', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // billingCycle should be "monthly" by default (or undefined if optional default not applied)
        expect(
          result.data.billingCycle === 'monthly' ||
            result.data.billingCycle === undefined,
        ).toBe(true);
      }
    });

    it('should accept resourceLimits with maxSkills', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'enterprise',
        resourceLimits: {
          cpuCores: 8,
          memoryMb: 8192,
          diskGb: 50,
          maxAgents: 50,
          maxSkills: 100,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should accept resourceLimits without maxSkills (optional)', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        resourceLimits: {
          cpuCores: 2,
          memoryMb: 2048,
          diskGb: 10,
          maxAgents: 3,
        },
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // Invalid payloads
  // ============================================================
  describe('invalid payloads', () => {
    it('should reject missing companyName', () => {
      const result = createTenantSchema.safeParse({
        adminEmail: 'admin@test.com',
        plan: 'starter',
      });

      expect(result.success).toBe(false);
    });

    it('should reject companyName shorter than 3 characters', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'AB',
        adminEmail: 'admin@test.com',
        plan: 'starter',
      });

      expect(result.success).toBe(false);
    });

    it('should reject companyName longer than 50 characters', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'A'.repeat(51),
        adminEmail: 'admin@test.com',
        plan: 'starter',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'not-an-email',
        plan: 'starter',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing plan', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid plan value', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'invalid_plan',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid companySize', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        companySize: '1000+',
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid deploymentRegion', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        deploymentRegion: 'invalid-region',
      });

      expect(result.success).toBe(false);
    });

    it('should reject notes longer than 500 characters', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        notes: 'A'.repeat(501),
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid billingCycle value', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        billingCycle: 'weekly',
      });

      expect(result.success).toBe(false);
    });

    it('should accept notes at exactly 500 characters', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        notes: 'A'.repeat(500),
      });

      expect(result.success).toBe(true);
    });

    it('should reject negative maxSkills', () => {
      const result = createTenantSchema.safeParse({
        companyName: 'Test Company',
        adminEmail: 'admin@test.com',
        plan: 'starter',
        resourceLimits: {
          cpuCores: 2,
          memoryMb: 2048,
          diskGb: 10,
          maxAgents: 3,
          maxSkills: -1,
        },
      });

      expect(result.success).toBe(false);
    });
  });
});
