import { describe, expect, it } from "vitest";
import { DAILY_USD } from "@/components/blog/daily-spend-data";
import { PUBLIC_ROUTES } from "../../scripts/public-routes.mjs";

describe("blog: kolik stojí AI agenti", () => {
  it("daily chart aggregates add up to the article's totals", () => {
    const grok = DAILY_USD.reduce((s, d) => s + d.grokBot, 0);
    const cursor = DAILY_USD.reduce((s, d) => s + d.cursor, 0);
    expect(DAILY_USD).toHaveLength(30);
    expect(Math.round(grok)).toBe(482);
    expect(Math.round(cursor)).toBe(377);
    expect(Math.round(grok + cursor)).toBe(859);
    const top = [...DAILY_USD].sort((a, b) => b.grokBot + b.cursor - (a.grokBot + a.cursor))[0];
    expect(top.day).toBe(22);
    expect(Math.round(top.grokBot + top.cursor)).toBe(258);
  });

  it("is in the prerender / sitemap routes", () => {
    expect(PUBLIC_ROUTES.some((r: { path: string }) => r.path === "/blog/kolik-stoji-ai-agenti")).toBe(true);
  });
});
