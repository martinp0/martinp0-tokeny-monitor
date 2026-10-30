import { describe, it, expect } from "vitest";
import { parseCSV } from "@/lib/csv-parser";
import sampleCSV from "@/data/sample.csv?raw";

const HEADER =
  "generation_id,created_at,cost_total,cost_web_search,cost_cache,cost_file_processing,byok_usage_inference,tokens_prompt,tokens_completion,tokens_reasoning,tokens_cached,model_permaslug,provider_name,variant,cancelled,streamed,user,finish_reason_raw,finish_reason_normalized,generation_time_ms,time_to_first_token_ms,app_name,api_key_name";

describe("parseCSV", () => {
  it("parses numbers, booleans and defaults", () => {
    const csv = `${HEADER}\ngen-1,2026-05-13 05:04:04.916,0.000377,,,,0,4712,1258,0,0,google/gemini-2.5-flash-lite,Google,standard,false,true,,completed,stop,5559,3358,OpenClaw,prod-api`;
    const [row] = parseCSV(csv);
    expect(row).toMatchObject({
      generation_id: "gen-1",
      created_at: "2026-05-13 05:04:04.916",
      cost_total: 0.000377,
      cost_web_search: 0,
      tokens_prompt: 4712,
      tokens_completion: 1258,
      model_permaslug: "google/gemini-2.5-flash-lite",
      provider_name: "Google",
      cancelled: false,
      streamed: true,
      generation_time_ms: 5559,
      provider_source: "openrouter",
      request_count: 1,
    });
  });

  it("drops rows without generation_id or created_at", () => {
    const csv = [HEADER, `,2026-01-01,1${",".repeat(20)}`, `gen-2,,1${",".repeat(20)}`, `gen-3,2026-01-01,1${",".repeat(20)}`].join("\n");
    const rows = parseCSV(csv);
    expect(rows.map((r) => r.generation_id)).toEqual(["gen-3"]);
  });

  it("deduplicates generation_id within a file (last wins)", () => {
    const csv = [HEADER, `gen-1,2026-01-01,1${",".repeat(20)}`, `gen-1,2026-01-01,2${",".repeat(20)}`].join("\n");
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].cost_total).toBe(2);
  });

  it("treats garbage numbers as 0 and tolerates header whitespace / CRLF", () => {
    const csv = `${HEADER.replace("cost_total", " cost_total ")}\r\ngen-9,2026-01-01,abc${",".repeat(20)}\r\n`;
    const [row] = parseCSV(csv);
    expect(row.cost_total).toBe(0);
  });

  it("parses the bundled sample export without losing rows", () => {
    const lines = sampleCSV.trim().split("\n").length - 1;
    const rows = parseCSV(sampleCSV);
    expect(rows.length).toBe(lines);
    expect(rows.every((r) => r.generation_id && r.created_at)).toBe(true);
  });
});
