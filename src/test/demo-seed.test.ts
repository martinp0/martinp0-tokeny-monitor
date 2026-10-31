import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DEMO_PREFIX, demoActivityRows, demoSubscription } from "../../scripts/app-review/demo-data.mjs";
import { isProSubscription } from "../../server/lib/plan";

const NOW = new Date("2026-10-30T12:00:00Z");

describe("App Review demo data", () => {
  const rows = demoActivityRows({ now: NOW });

  it("is deterministic and covers ~75 days for 5 models", () => {
    expect(demoActivityRows({ now: NOW })).toEqual(rows);
    expect(rows).toHaveLength(75 * 5);
    expect(new Set(rows.map((r) => r.generation_id)).size).toBe(rows.length);
    expect(rows.every((r) => String(r.generation_id).startsWith(DEMO_PREFIX))).toBe(true);
    expect(rows.at(-1)!.created_at.slice(0, 10)).toBe("2026-10-30");
  });

  it("only uses provider sources the DB accepts and sane numbers", () => {
    expect(new Set(rows.map((r) => r.provider_source))).toEqual(new Set(["anthropic", "openai", "openrouter"]));
    for (const r of rows) {
      expect(r.cost_total).toBeGreaterThan(0);
      expect(r.tokens_cached).toBeLessThanOrEqual(r.tokens_prompt as number);
      expect(r.request_count).toBeGreaterThanOrEqual(1);
    }
    const month = rows.filter((r) => String(r.created_at).startsWith("2026-10")).reduce((s, r) => s + (r.cost_total as number), 0);
    expect(month).toBeGreaterThan(5);
    expect(month).toBeLessThan(500);
  });

  it("gives Pro without a real Stripe customer", () => {
    const sub = demoSubscription("u1", NOW);
    expect(isProSubscription(sub, NOW)).toBe(true);
    expect(sub.stripe_customer_id).toBe("cus_demo_app_review");
  });

  it("the seed script reads secrets only from env and never logs them", () => {
    const src = readFileSync("scripts/app-review/seed-demo-user.mjs", "utf8");
    expect(src).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT-looking literal
    expect(src).not.toMatch(/console\.\w+\([^)]*(SERVICE_ROLE_KEY|DEMO_PASSWORD)\b(?![^)]*must)/);
  });
});
