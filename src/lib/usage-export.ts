import Papa from "papaparse";
import type { ActivityRow, BillingType, ProviderSource } from "@/lib/csv-parser";

/**
 * Importer for the usage CSV that Cursor and Grok Bot export:
 *
 *   Billing Item ID, Event Time, Product (cursor|grok-bot), Charge Category, Usage Type
 *   (included|on_demand|credits), Principal Type, Principal ID, Usage (JSON string with
 *   cache-write-text-tokens / cached-prompt-text-tokens / completion-text-tokens /
 *   prompt-text-tokens), Pricing Currency, Pricing Contracted (cost), Model, User Email
 *
 * Mapping onto activity_rows:
 * - generation_id    = Billing Item ID (dedupe key together with user_id)
 * - tokens_prompt    = fresh input + cached reads + cache writes (total input, same meaning as OpenRouter)
 * - tokens_cached    = cached-prompt-text-tokens, tokens_cache_write = cache-write-text-tokens
 * - cost_total       = Pricing Contracted (USD); billing_type = Usage Type
 * - Principal ID and User Email are NOT stored (not needed for the dashboard).
 */

export const USAGE_EXPORT_REQUIRED = ["Billing Item ID", "Event Time", "Product", "Usage"] as const;

const PRODUCTS: Record<string, { source: ProviderSource; name: string }> = {
  cursor: { source: "cursor", name: "Cursor" },
  "grok-bot": { source: "grok-bot", name: "Grok Bot" },
};
const BILLING_TYPES: readonly BillingType[] = ["included", "on_demand", "credits"];

/** True when the CSV header row is a Cursor / Grok Bot usage export. */
export function isUsageExportHeader(headerLine: string): boolean {
  const cols = Papa.parse<string[]>(headerLine.split(/\r?\n/, 1)[0] ?? "").data[0] ?? [];
  const set = new Set(cols.map((c) => c.trim().replace(/^\uFEFF/, "")));
  return USAGE_EXPORT_REQUIRED.every((c) => set.has(c));
}

const int = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};
const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

export type SkipReason = "missing_id" | "bad_time" | "unknown_product" | "currency";

/** Maps one export row. Returns a skip reason instead of a row when it can't be stored. */
export function mapUsageExportRow(row: Record<string, string>): ActivityRow | SkipReason {
  const id = (row["Billing Item ID"] ?? "").trim();
  if (!id) return "missing_id";
  const time = (row["Event Time"] ?? "").trim();
  if (!time || Number.isNaN(Date.parse(time))) return "bad_time";
  const product = PRODUCTS[(row["Product"] ?? "").trim().toLowerCase()];
  if (!product) return "unknown_product";
  const currency = (row["Pricing Currency"] ?? "").trim().toUpperCase();
  if (currency && currency !== "USD") return "currency";

  let usage: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row["Usage"] || "{}");
    if (parsed && typeof parsed === "object") usage = parsed as Record<string, unknown>;
  } catch {
    usage = {};
  }
  const fresh = int(usage["prompt-text-tokens"]);
  const cached = int(usage["cached-prompt-text-tokens"]);
  const cacheWrite = int(usage["cache-write-text-tokens"]);
  const output = int(usage["completion-text-tokens"]);

  const usageType = (row["Usage Type"] ?? "").trim().toLowerCase() as BillingType;
  const model = (row["Model"] ?? "").trim();

  return {
    generation_id: id,
    created_at: new Date(time).toISOString(),
    cost_total: num(row["Pricing Contracted"]),
    cost_web_search: 0,
    cost_cache: 0,
    cost_file_processing: 0,
    byok_usage_inference: 0,
    tokens_prompt: fresh + cached + cacheWrite,
    tokens_completion: output,
    tokens_reasoning: 0,
    tokens_cached: cached,
    tokens_cache_write: cacheWrite,
    model_permaslug: model || product.source,
    provider_name: product.name,
    variant: "",
    cancelled: false,
    streamed: false,
    user: "",
    finish_reason_raw: "",
    finish_reason_normalized: "",
    generation_time_ms: 0,
    time_to_first_token_ms: 0,
    app_name: product.name,
    api_key_name: "",
    provider_source: product.source,
    request_count: 1,
    billing_type: BILLING_TYPES.includes(usageType) ? usageType : null,
  };
}

export interface UsageImportStats {
  rows: number;
  mapped: number;
  duplicatesInFile: number;
  skipped: Record<SkipReason, number>;
}

export interface StreamOptions {
  /** Rows handed to onBatch at once (and per DB upsert). */
  batchSize?: number;
  /** Bytes read per Papa chunk. */
  chunkSize?: number;
  /** Awaited before parsing continues, so DB writes apply back-pressure. */
  onBatch: (rows: ActivityRow[]) => Promise<void> | void;
  /** 0..1, based on bytes consumed. */
  onProgress?: (fraction: number) => void;
}

/**
 * Streams a usage export (File in the browser, string in tests) in chunks, never holding the whole
 * file or all rows in memory. Duplicate Billing Item IDs inside the file are dropped (first wins), so a
 * single upsert batch never hits the same conflict key twice.
 */
export function streamUsageExport(input: File | Blob | string, opts: StreamOptions): Promise<UsageImportStats> {
  const batchSize = opts.batchSize ?? 1000;
  const total = typeof input === "string" ? input.length : input.size;
  const seen = new Set<string>();
  const stats: UsageImportStats = {
    rows: 0,
    mapped: 0,
    duplicatesInFile: 0,
    skipped: { missing_id: 0, bad_time: 0, unknown_product: 0, currency: 0 },
  };
  let pending: ActivityRow[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    await opts.onBatch(batch);
  };

  return new Promise((resolve, reject) => {
    let failed = false;
    let chain: Promise<void> = Promise.resolve();
    Papa.parse<Record<string, string>>(input as File, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().replace(/^\uFEFF/, ""),
      chunkSize: opts.chunkSize ?? 1024 * 1024,
      chunk: (results, parser) => {
        parser.pause();
        for (const row of results.data) {
          stats.rows += 1;
          const mapped = mapUsageExportRow(row);
          if (typeof mapped === "string") {
            stats.skipped[mapped] += 1;
            continue;
          }
          if (seen.has(mapped.generation_id)) {
            stats.duplicatesInFile += 1;
            continue;
          }
          seen.add(mapped.generation_id);
          stats.mapped += 1;
          pending.push(mapped);
        }
        const cursor = results.meta.cursor;
        // Papa may fire `complete` right after the last chunk callback, even while paused, so all
        // writes go through one promise chain and `complete` waits for it.
        chain = chain
          .then(async () => {
            while (pending.length >= batchSize) await opts.onBatch(pending.splice(0, batchSize));
            if (total > 0) opts.onProgress?.(Math.min(1, cursor / total));
          })
          .then(
            () => parser.resume(),
            (e) => {
              if (!failed) {
                failed = true;
                parser.abort();
                reject(e);
              }
            },
          );
      },
      complete: () => {
        chain = chain.then(async () => {
          if (failed) return;
          try {
            await flush();
            opts.onProgress?.(1);
            resolve(stats);
          } catch (e) {
            failed = true;
            reject(e);
          }
        });
      },
      error: (e: Error) => {
        failed = true;
        reject(e);
      },
    });
  });
}

/** Cached vs fresh token split and plan vs over-plan cost, for the dashboard breakdown card. */
export interface UsageBreakdown {
  freshInput: number;
  cachedRead: number;
  cacheWrite: number;
  output: number;
  includedCost: number;
  onDemandCost: number;
  creditsCost: number;
  includedCalls: number;
  onDemandCalls: number;
  creditsCalls: number;
}

export function usageBreakdown(rows: ActivityRow[]): UsageBreakdown | null {
  const b: UsageBreakdown = {
    freshInput: 0, cachedRead: 0, cacheWrite: 0, output: 0,
    includedCost: 0, onDemandCost: 0, creditsCost: 0,
    includedCalls: 0, onDemandCalls: 0, creditsCalls: 0,
  };
  let any = false;
  for (const r of rows) {
    if (!r.billing_type) continue;
    any = true;
    const cw = r.tokens_cache_write ?? 0;
    b.cachedRead += r.tokens_cached;
    b.cacheWrite += cw;
    b.freshInput += Math.max(0, r.tokens_prompt - r.tokens_cached - cw);
    b.output += r.tokens_completion;
    const calls = r.request_count ?? 1;
    if (r.billing_type === "included") { b.includedCost += r.cost_total; b.includedCalls += calls; }
    else if (r.billing_type === "on_demand") { b.onDemandCost += r.cost_total; b.onDemandCalls += calls; }
    else { b.creditsCost += r.cost_total; b.creditsCalls += calls; }
  }
  return any ? b : null;
}
