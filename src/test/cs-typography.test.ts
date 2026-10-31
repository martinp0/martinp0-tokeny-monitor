import { describe, expect, it } from "vitest";
import { csCopy } from "@/lib/cs-typography";

const NBSP_GAP = /(^|\s)[kKsSvVzZoOuUaAiI] (?=\S)/;

describe("csCopy", () => {
  it("puts a non-breaking space after one-letter Czech prepositions", () => {
    const out = csCopy("Náklady v CZK i USD a Android");
    expect(out).toBe("Náklady v\u00A0CZK i\u00A0USD a\u00A0Android");
    expect(NBSP_GAP.test(out)).toBe(false);
  });

  it("fixes consecutive one-letter words", () => {
    const out = csCopy("Co to je MCP server a k čemu mi je?");
    expect(out).toBe("Co to je MCP server a\u00A0k\u00A0čemu mi je?");
    expect(NBSP_GAP.test(out)).toBe(false);
  });

  it("replaces an em dash and leaves words like iOS alone", () => {
    const out = csCopy("tablet i jako app pro iOS — hotovo");
    expect(out).toBe("tablet i\u00A0jako app pro iOS – hotovo");
    expect(NBSP_GAP.test(out)).toBe(false);
  });
});
