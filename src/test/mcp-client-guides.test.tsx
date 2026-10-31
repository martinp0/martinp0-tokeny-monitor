import { describe, it, expect, beforeAll } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import i18n from "@/i18n";
import cs from "@/i18n/cs.json";
import en from "@/i18n/en.json";
import { McpClientGuides } from "@/components/settings/McpClientGuides";

const URL = "https://abcdefghijklmnopqrst.supabase.co/functions/v1/mcp";

function keys(o: unknown, prefix = ""): string[] {
  if (o && typeof o === "object" && !Array.isArray(o)) {
    return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("McpClientGuides", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("en");
  });

  it("has the same mcpClients keys in cs and en", () => {
    expect(keys(cs.mcpClients).sort()).toEqual(keys(en.mcpClients).sort());
  });

  it("shows a Grok Bot card with URL, header and a ready-to-send prompt", () => {
    render(<McpClientGuides url={URL} />);
    const grok = screen.getByRole("region", { name: "Grok Bot" });
    const text = grok.textContent ?? "";
    expect(text).toContain(URL);
    expect(text).toContain("Authorization");
    expect(text).toContain("Bearer <TOKEN>");
    expect(text).toContain(`Add a custom MCP server named tokeny at ${URL}`);
    expect(within(grok).getAllByRole("button", { name: /^Copy:/ }).length).toBeGreaterThanOrEqual(5);
  });

  it("lists Cursor, Claude Code and Claude Desktop next to Grok Bot, all with the same URL", () => {
    render(<McpClientGuides url={URL} />);
    for (const name of ["Cursor", "Claude Code", "Claude Desktop"]) {
      expect(screen.getByRole("region", { name }).textContent).toContain(URL);
    }
  });

  it("renders in Czech", async () => {
    await act(() => i18n.changeLanguage("cs"));
    render(<McpClientGuides url={URL} />);
    expect(screen.getByRole("region", { name: "Grok Bot" }).textContent).toContain("Přidej vlastní (custom) MCP server s názvem tokeny");
    cleanup();
    await act(() => i18n.changeLanguage("en"));
  });

  it("FAQ has a Grok Bot entry in both languages", () => {
    expect(cs.landing.faq.items.some((i) => i.q.includes("Grok Bot"))).toBe(true);
    expect(en.landing.faq.items.some((i) => i.q.includes("Grok Bot"))).toBe(true);
  });
});
