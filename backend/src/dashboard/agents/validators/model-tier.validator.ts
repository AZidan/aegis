/**
 * Model Tier Validation
 *
 * Validates model tier and thinking mode against tenant plan restrictions.
 * Based on pricing-model.md Section 3.1.
 *
 * Plan restrictions:
 *   Starter:    Sonnet only, Off/Low thinking only
 *   Growth:     Sonnet + Opus, all thinking modes
 *   Enterprise: Haiku + Sonnet + Opus, all thinking modes
 */

export interface ModelTierValidationResult {
  valid: boolean;
  error?: string;
}

/** Allowed model tiers per plan */
const PLAN_ALLOWED_MODELS: Record<string, string[]> = {
  starter: ['sonnet'],
  growth: ['sonnet', 'opus'],
  enterprise: ['haiku', 'sonnet', 'opus'],
};

/**
 * Allowed thinking modes per plan.
 * Prisma enum values: fast, standard, extended
 * DTO values:         off, low, high
 *
 * The validator accepts BOTH formats so it works regardless of
 * whether the value has already been transformed.
 */
const PLAN_ALLOWED_THINKING: Record<string, string[]> = {
  starter: ['fast', 'standard', 'off', 'low'],
  growth: ['fast', 'standard', 'extended', 'off', 'low', 'high'],
  enterprise: ['fast', 'standard', 'extended', 'off', 'low', 'high'],
};

/**
 * Pure function: validate modelTier + thinkingMode against a tenant plan.
 */
export function validateModelTierForPlan(
  plan: string,
  modelTier: string,
  thinkingMode?: string,
): ModelTierValidationResult {
  const allowedModels = PLAN_ALLOWED_MODELS[plan];
  if (!allowedModels) {
    return { valid: false, error: `Unknown plan: ${plan}` };
  }

  if (!allowedModels.includes(modelTier)) {
    const modelNames = allowedModels.join(', ');
    return {
      valid: false,
      error: `Model tier "${modelTier}" is not available on the ${plan} plan. Available models: ${modelNames}`,
    };
  }

  if (thinkingMode) {
    const allowedThinking = PLAN_ALLOWED_THINKING[plan];
    if (!allowedThinking.includes(thinkingMode)) {
      return {
        valid: false,
        error: `Thinking mode "${thinkingMode}" is not available on the ${plan} plan`,
      };
    }
  }

  return { valid: true };
}
