import { describe, it, expect } from "vitest";
import {
  FREE_LIMITS,
  canAddProvider,
  clampFromForPlan,
  freeHistoryFloor,
  isProSubscription,
  proRequiredBody,
  syncableCredentialIds,
} from "../../server/lib/plan";
import { splitRowsForPlan } from "@/lib/plan";

const NOW = new Date("2026-10-30T12:00:00Z");
const future = "2026-11-30T00:00:00Z";
const past = "2026-10-01T00:00:00Z";

describe("isProSubscription", () => {
  it.each([
    ["active", future, true],
    ["trialing", future, true],
    ["past_due", future, true],
    ["canceled", future, false],
    ["incomplete", future, false],
    ["unpaid", future, false],
    ["paused", future, false],
    ["active", past, false],
  ])("%s until %s → %s", (status, end, expected) => {
    expect(isProSubscription({ status, current_period_end: end }, NOW)).toBe(expected);
  });

  it("no row / no status is free", () => {
    expect(isProSubscription(null, NOW)).toBe(false);
    expect(isProSubscription(undefined, NOW)).toBe(false);
    expect(isProSubscription({ status: null, current_period_end: future }, NOW)).toBe(false);
  });

  it("missing period end trusts the status", () => {
    expect(isProSubscription({ status: "active", current_period_end: null }, NOW)).toBe(true);
  });
});

describe("history window", () => {
  it("floor is 30 days back (UTC date)", () => {
    expect(FREE_LIMITS.historyDays).toBe(30);
    expect(freeHistoryFloor(NOW)).toBe("2026-09-30");
  });

  it("clamps `from` only for free users", () => {
    expect(clampFromForPlan(null, true, NOW)).toBeNull();
    expect(clampFromForPlan("2025-01-01", true, NOW)).toBe("2025-01-01");
    expect(clampFromForPlan(null, false, NOW)).toBe("2026-09-30");
    expect(clampFromForPlan("2025-01-01", false, NOW)).toBe("2026-09-30");
    expect(clampFromForPlan("2026-10-15", false, NOW)).toBe("2026-10-15");
  });

  it("splitRowsForPlan drops old rows for free users only", () => {
    const rows = [
      { created_at: "2026-10-29 10:00:00" },
      { created_at: "2026-09-30T00:00:00Z" },
      { created_at: "2026-09-29T23:59:59Z" },
      { created_at: "2025-01-01" },
    ];
    expect(splitRowsForPlan(rows, true, NOW)).toEqual({ keep: rows, skipped: 0 });
    const free = splitRowsForPlan(rows, false, NOW);
    expect(free.keep.map((r) => r.created_at)).toEqual(["2026-10-29 10:00:00", "2026-09-30T00:00:00Z"]);
    expect(free.skipped).toBe(2);
  });
});

describe("providers", () => {
  it("free users get one provider, Pro unlimited", () => {
    expect(canAddProvider(false, [])).toBe(true);
    expect(canAddProvider(false, ["a"])).toBe(false);
    expect(canAddProvider(true, ["a", "b", "c"])).toBe(true);
  });

  it("free users may re-save (rotate) their existing key", () => {
    expect(canAddProvider(false, ["a"], "a")).toBe(true);
    expect(canAddProvider(false, ["a", "b"], "b")).toBe(true); // rotating never adds a provider
    expect(canAddProvider(false, ["a", "b"], "zzz")).toBe(false);
  });

  it("free users sync only their oldest credential", () => {
    const creds = [
      { id: "b", created_at: "2026-02-01T00:00:00Z" },
      { id: "a", created_at: "2026-01-01T00:00:00Z" },
      { id: "c", created_at: "2026-03-01T00:00:00Z" },
    ];
    expect([...syncableCredentialIds(creds, false)]).toEqual(["a"]);
    expect(syncableCredentialIds(creds, true).size).toBe(3);
    expect(syncableCredentialIds([], false).size).toBe(0);
  });
});

it("pro_required error body", () => {
  expect(proRequiredBody("mcp")).toMatchObject({ error: "pro_required", feature: "mcp" });
});
