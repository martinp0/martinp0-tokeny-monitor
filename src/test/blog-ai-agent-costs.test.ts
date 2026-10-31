import { describe, expect, it } from "vitest";
import { DAILY_USD } from "@/components/blog/daily-spend-data";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("is listed in the sitemap on the main domain", () => {
    const sitemap = readFileSync(resolve(__dirname, "../../public/sitemap.xml"), "utf8");
    expect(sitemap).toContain("https://tokeny.martinpohl.cz/blog/kolik-stoji-ai-agenti");
    expect(sitemap).not.toMatch(/tokeny\.pohl\.uk/);
  });
});
