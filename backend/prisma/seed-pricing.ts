import { PrismaClient } from './generated/client';

/**
 * Seed ProviderPricing table with current LLM provider rates.
 * Based on pricing-model.md (Feb 2026).
 */
export async function seedPricing(prisma: PrismaClient): Promise<void> {
  console.log('\n  Seeding provider pricing...');

  const effectiveFrom = new Date('2026-01-01');

  const pricingData = [
    // Anthropic
    { provider: 'anthropic', model: 'claude-haiku-4-5', inputPer1M: 1, outputPer1M: 5, thinkingPer1M: 5 },
    { provider: 'anthropic', model: 'claude-sonnet-4-5', inputPer1M: 3, outputPer1M: 15, thinkingPer1M: 15 },
    { provider: 'anthropic', model: 'claude-opus-4-5', inputPer1M: 5, outputPer1M: 25, thinkingPer1M: 25 },
    // OpenAI
    { provider: 'openai', model: 'gpt-4o', inputPer1M: 5, outputPer1M: 15, thinkingPer1M: 15 },
    { provider: 'openai', model: 'gpt-4o-mini', inputPer1M: 0.15, outputPer1M: 0.6, thinkingPer1M: 0.6 },
    { provider: 'openai', model: 'o3-mini', inputPer1M: 1.1, outputPer1M: 4.4, thinkingPer1M: 4.4 },
    // Google
    { provider: 'google', model: 'gemini-2.0-flash', inputPer1M: 0.075, outputPer1M: 0.3, thinkingPer1M: 0 },
    { provider: 'google', model: 'gemini-2.0-pro', inputPer1M: 1.25, outputPer1M: 10, thinkingPer1M: 10 },
  ];

  for (const p of pricingData) {
    await (prisma as any).providerPricing.upsert({
      where: {
        provider_model_effectiveFrom: {
          provider: p.provider,
          model: p.model,
          effectiveFrom,
        },
      },
      update: {
        inputPer1M: p.inputPer1M,
        outputPer1M: p.outputPer1M,
        thinkingPer1M: p.thinkingPer1M,
      },
      create: {
        provider: p.provider,
        model: p.model,
        inputPer1M: p.inputPer1M,
        outputPer1M: p.outputPer1M,
        thinkingPer1M: p.thinkingPer1M,
        effectiveFrom,
        effectiveTo: null,
      },
    });
    console.log(`  Pricing: ${p.provider}/${p.model} — $${p.inputPer1M}/$${p.outputPer1M} per 1M tokens`);
  }
}
