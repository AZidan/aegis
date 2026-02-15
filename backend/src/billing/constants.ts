/**
 * Billing Module Constants
 * Sprint 4 — E12-03 + Sprint 5 — E12-06/07/08/09
 */
export const USAGE_TRACKING_QUEUE = 'usage-tracking';

export const USAGE_TRACKING_JOBS = {
  RECORD_USAGE: 'record-usage',
  RESET_MONTHLY: 'reset-monthly',
  CHECK_USAGE_WARNINGS: 'check-usage-warnings',
} as const;

// --- Sprint 5: Billing API Constants ---

/** Monthly platform fees per plan (USD) */
export const PLAN_PLATFORM_FEES: Record<string, number> = {
  starter: 99,
  growth: 299,
  enterprise: 0, // custom pricing
};

/** Number of agents included in the platform fee per plan */
export const PLAN_INCLUDED_AGENTS: Record<string, number> = {
  starter: 2,
  growth: 5,
  enterprise: 0, // unlimited / custom
};

/** Monthly fee per additional agent by model tier (USD) */
export const AGENT_MONTHLY_FEES: Record<string, number> = {
  haiku: 19,
  sonnet: 49,
  opus: 99,
};

/** Percentage surcharge for extended thinking mode */
export const THINKING_SURCHARGE = 20;

/** Default per-agent monthly token quota (2.5M tokens) */
export const DEFAULT_TOKEN_QUOTA_PER_AGENT = 2_500_000;

/** Usage threshold percentages */
export const USAGE_THRESHOLDS = {
  WARNING: 80,
  GRACE: 100,
  RATE_LIMITED: 120,
  PAUSED: 150,
} as const;

/** Overage rate pricing per 1M tokens by model tier (USD) */
export const OVERAGE_RATES: Record<string, { input: number; output: number }> = {
  haiku: { input: 8, output: 8 },
  sonnet: { input: 5, output: 20 },
  opus: { input: 8, output: 35 },
};
