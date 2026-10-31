import { describe, it, expect, vi } from "vitest";
import {
  ACTIVITY_CONFLICT_TARGET,
  anthropicGenerationId,
  anthropicPriceFor,
  collectPages,
  dedupeByGenerationId,
  isSupportedSyncProvider,
  mapAnthropicBuckets,
  mapOpenRouterItem,
  nextPageCursor,
  openAIGenerationId,
  openRouterGenerationId,
  upsertInBatches,
  type ActivityRowInsert,
} from "../../server/lib/sync-core";

describe("sync id builders (stable formats — existing rows must keep matching)", () => {
  it("openrouter", () => {
    expect(openRouterGenerationId({ date: "2026-05-01", model_permaslug: "openai/gpt-5", endpoint_id: "ep1" })).toBe(
      "2026-05-01_openai/gpt-5_ep1",
    );
    expect(openRouterGenerationId({ date: "2026-05-01", model_permaslug: "openai/gpt-5" })).toBe("2026-05-01_openai/gpt-5_");
  });
  it("anthropic", () => {
    expect(anthropicGenerationId("2026-05-01T00:00:00Z", { model: "claude-sonnet-4-5", service_tier: "standard", workspace_id: null })).toBe(
      "anthropic::2026-05-01T00:00:00Z::claude-sonnet-4-5::standard::main",
    );
  });
  it("openai", () => {
    expect(openAIGenerationId(1746057600, { model: "gpt-4o" })).toBe("openai::1746057600::gpt-4o::main::any");
  });
  it("upserts conflict on (user_id, generation_id)", () => {
    expect(ACTIVITY_CONFLICT_TARGET).toBe("user_id,generation_id");
  });
  it("only supports providers with a real sync", () => {
    expect(["openrouter", "anthropic", "openai"].every(isSupportedSyncProvider)).toBe(true);
    expect(["gemini", "mistral", "groq", "xai", "", null].some(isSupportedSyncProvider)).toBe(false);
  });
});

describe("pagination cursor", () => {
  it("follows next_page only while has_more", () => {
    expect(nextPageCursor({ has_more: true, next_page: "p2" })).toBe("p2");
    // regression: old code `next_page ?? has_more ? next_cursor : null` returned null here
    expect(nextPageCursor({ has_more: true, next_page: "abc" })).not.toBeNull();
    expect(nextPageCursor({ has_more: false, next_page: "p2" })).toBeNull();
    expect(nextPageCursor({ has_more: true, next_page: null })).toBeNull();
    expect(nextPageCursor(null)).toBeNull();
  });

  it("collectPages drains all pages and guards against loops", async () => {
    const pages: Record<string, { has_more: boolean; next_page: string | null; data: number[] }> = {
      start: { has_more: true, next_page: "b", data: [1] },
      b: { has_more: true, next_page: "c", data: [2] },
      c: { has_more: false, next_page: null, data: [3] },
    };
    const fetchPage = vi.fn(async (cursor: string | null) => pages[cursor ?? "start"]);
    const out = await collectPages(fetchPage);
    expect(out.flatMap((p) => p.data)).toEqual([1, 2, 3]);
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([null, "b", "c"]);

    const looping = vi.fn(async () => ({ has_more: true, next_page: "same" }));
    expect(await collectPages(looping)).toHaveLength(2);
    const endless = vi.fn(async (c: string | null) => ({ has_more: true, next_page: `${c ?? ""}x` }));
    expect(await collectPages(endless, 5)).toHaveLength(5);
  });
});

describe("mappers", () => {
  it("maps OpenRouter activity items for the calling user", () => {
    const row = mapOpenRouterItem(
      { date: "2026-05-01", model: "openai/gpt-5", model_permaslug: "openai/gpt-5-2025", endpoint_id: "e", provider_name: "OpenAI", usage: 1.5, byok_usage_inference: 0.2, requests: 12, prompt_tokens: 100, completion_tokens: 50, reasoning_tokens: 5, cached_tokens: 10 },
      "user-1",
    )!;
    expect(row).toMatchObject({
      generation_id: "2026-05-01_openai/gpt-5-2025_e",
      user_id: "user-1",
      created_at: "2026-05-01",
      cost_total: 1.5,
      byok_usage_inference: 0.2,
      request_count: 12,
      tokens_prompt: 100,
      tokens_cached: 10,
      provider_source: "openrouter",
    });
    expect(mapOpenRouterItem({ model_permaslug: "x" }, "u")).toBeNull();
  });

  it("maps Anthropic buckets using starting_at and cache_creation breakdown", () => {
    const rows = mapAnthropicBuckets(
      [
        {
          starting_at: "2026-05-01T00:00:00Z",
          ending_at: "2026-05-02T00:00:00Z",
          results: [
            {
              model: "claude-sonnet-4-5-20250929",
              service_tier: "standard",
              workspace_id: null,
              uncached_input_tokens: 1_000_000,
              cache_creation: { ephemeral_5m_input_tokens: 1_000_000, ephemeral_1h_input_tokens: 0 },
              cache_read_input_tokens: 1_000_000,
              output_tokens: 1_000_000,
            },
            { model: "claude-haiku-4-5", uncached_input_tokens: 0, output_tokens: 0 },
          ],
        },
        { results: [{ model: "x", output_tokens: 5 }] }, // no start → skipped
      ],
      "user-2",
    );
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(r.created_at).toBe("2026-05-01T00:00:00Z");
    expect(r.user_id).toBe("user-2");
    expect(r.tokens_prompt).toBe(3_000_000);
    expect(r.tokens_cached).toBe(1_000_000);
    // sonnet: 3 in + 15 out + 3.75 cache write + 0.30 cache read
    expect(r.cost_total).toBeCloseTo(22.05, 6);
    expect(r.cost_cache).toBeCloseTo(4.05, 6);
  });

  it("prices Opus 4/4.1 at legacy rates and Opus 4.5+ at new rates", () => {
    expect(anthropicPriceFor("claude-opus-4-20250514").input).toBe(15);
    expect(anthropicPriceFor("claude-opus-4-1-20250805").input).toBe(15);
    expect(anthropicPriceFor("claude-opus-4-5-20251101").input).toBe(5);
    expect(anthropicPriceFor("claude-3-5-haiku-20241022").input).toBe(0.8);
    expect(anthropicPriceFor("something-new").input).toBe(3);
  });
});

describe("upsertInBatches", () => {
  const mk = (id: string): ActivityRowInsert => ({
    generation_id: id, user_id: "u", created_at: "2026-01-01", cost_total: 0, tokens_prompt: 0, tokens_completion: 0,
    tokens_reasoning: 0, tokens_cached: 0, model_permaslug: "m", provider_name: "p", provider_source: "openai", request_count: 1,
  });

  it("dedupes, batches and reports (does not swallow) errors", async () => {
    const rows = [mk("a"), mk("b"), mk("a"), mk("c"), mk("d")];
    expect(dedupeByGenerationId(rows)).toHaveLength(4);
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "duplicate key" } });
    const res = await upsertInBatches(rows, upsert, 2);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ upserted: 2, failed: 2, errors: ["duplicate key"] });
  });
});
