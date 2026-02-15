import { validateModelTierForPlan } from '../../../src/dashboard/agents/validators/model-tier.validator';

// ---------------------------------------------------------------------------
// Test Suite: validateModelTierForPlan
// ---------------------------------------------------------------------------
describe('validateModelTierForPlan', () => {
  // =========================================================================
  // Starter plan
  // =========================================================================
  describe('starter plan', () => {
    it('should allow sonnet on starter', () => {
      const result = validateModelTierForPlan('starter', 'sonnet');
      expect(result).toEqual({ valid: true });
    });

    it('should reject opus on starter (model not available)', () => {
      const result = validateModelTierForPlan('starter', 'opus');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not available on the starter plan');
    });

    it('should reject haiku on starter (model not available)', () => {
      const result = validateModelTierForPlan('starter', 'haiku');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not available on the starter plan');
    });

    it('should allow sonnet + fast thinking on starter', () => {
      const result = validateModelTierForPlan('starter', 'sonnet', 'fast');
      expect(result).toEqual({ valid: true });
    });

    it('should reject sonnet + extended thinking on starter', () => {
      const result = validateModelTierForPlan('starter', 'sonnet', 'extended');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not available on the starter plan');
    });
  });

  // =========================================================================
  // Growth plan
  // =========================================================================
  describe('growth plan', () => {
    it('should allow opus on growth', () => {
      const result = validateModelTierForPlan('growth', 'opus');
      expect(result).toEqual({ valid: true });
    });

    it('should allow sonnet + extended thinking on growth', () => {
      const result = validateModelTierForPlan('growth', 'sonnet', 'extended');
      expect(result).toEqual({ valid: true });
    });

    it('should reject haiku on growth (model not available)', () => {
      const result = validateModelTierForPlan('growth', 'haiku');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not available on the growth plan');
    });
  });

  // =========================================================================
  // Enterprise plan
  // =========================================================================
  describe('enterprise plan', () => {
    it('should allow haiku on enterprise', () => {
      const result = validateModelTierForPlan('enterprise', 'haiku');
      expect(result).toEqual({ valid: true });
    });

    it('should allow opus + extended thinking on enterprise', () => {
      const result = validateModelTierForPlan('enterprise', 'opus', 'extended');
      expect(result).toEqual({ valid: true });
    });

    it('should allow sonnet on enterprise', () => {
      const result = validateModelTierForPlan('enterprise', 'sonnet');
      expect(result).toEqual({ valid: true });
    });
  });

  // =========================================================================
  // Unknown plan
  // =========================================================================
  describe('unknown plan', () => {
    it('should reject unknown plan', () => {
      const result = validateModelTierForPlan('premium', 'sonnet');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown plan: premium');
    });
  });
});
