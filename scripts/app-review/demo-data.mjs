// Deterministic sample usage for the App Review demo account. Pure, no I/O (tested in
// src/test/demo-seed.test.ts). Rows look like real API usage but are made up.

export const DEMO_PREFIX = "demo-app-review-";

const MODELS = [
  // [provider_source, provider_name, model_permaslug, $ per 1M prompt, $ per 1M completion, weight]
  ["anthropic", "Anthropic", "anthropic/claude-sonnet-4.5", 3, 15, 5],
  ["anthropic", "Anthropic", "anthropic/claude-haiku-4.5", 1, 5, 3],
  ["openai", "OpenAI", "openai/gpt-5", 1.25, 10, 4],
  ["openai", "OpenAI", "openai/gpt-5-mini", 0.25, 2, 3],
  ["openrouter", "OpenRouter", "google/gemini-2.5-flash", 0.3, 2.5, 2],
];
const APPS = ["Tokeny demo", "Support bot", "Code review"];

/** Small seeded PRNG (mulberry32) so every run produces the same data. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One aggregated row per model per day for the last `days` days, ending at `now`.
 * @returns {Array<Record<string, unknown>>} activity_rows inserts (without user_id).
 */
export function demoActivityRows({ now = new Date(), days = 75, seed = 42 } = {}) {
  const r = rng(seed);
  const totalWeight = MODELS.reduce((s, m) => s + m[5], 0);
  const rows = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d, 9 + Math.floor(r() * 9)));
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    for (const [source, providerName, model, pIn, pOut, weight] of MODELS) {
      const requests = Math.max(1, Math.round((weekend ? 6 : 22) * (weight / totalWeight) * 5 * (0.6 + r() * 0.8)));
      const prompt = Math.round(requests * (1800 + r() * 2400));
      const completion = Math.round(requests * (350 + r() * 650));
      const cached = Math.round(prompt * (source === "anthropic" ? 0.35 : 0.2) * r());
      const cost = ((prompt - cached) * pIn + cached * pIn * 0.1 + completion * pOut) / 1e6;
      rows.push({
        generation_id: `${DEMO_PREFIX}${day.toISOString().slice(0, 10)}-${model}`,
        created_at: day.toISOString(),
        cost_total: Math.round(cost * 1e6) / 1e6,
        tokens_prompt: prompt,
        tokens_completion: completion,
        tokens_cached: cached,
        tokens_reasoning: 0,
        model_permaslug: model,
        provider_name: providerName,
        provider_source: source,
        app_name: APPS[Math.floor(r() * APPS.length)],
        request_count: requests,
      });
    }
  }
  return rows;
}

/** A Pro subscription row that is not backed by Stripe (fake customer id → delete-account treats it as missing). */
export function demoSubscription(userId, now = new Date()) {
  const end = new Date(now);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return {
    user_id: userId,
    stripe_customer_id: "cus_demo_app_review",
    stripe_subscription_id: null,
    status: "active",
    current_period_end: end.toISOString(),
  };
}
