# CSV import

Upload a CSV from the dashboard ("Upload CSV" or the first-run screen). The importer is picked from the header row.

| Export | Detected by | Parser |
|---|---|---|
| OpenRouter activity | `generation_id`, `created_at`, … | `src/lib/csv-parser.ts` (whole file) |
| Cursor / Grok Bot usage | `Billing Item ID`, `Event Time`, `Product`, `Usage` | `src/lib/usage-export.ts` (streaming) |

## Cursor / Grok Bot usage export

- The file is parsed **in the browser** in 1 MB chunks (Papa Parse `chunk` with pause/resume). It is written in batches of 500 rows, and the button shows progress in %. Martin's own 23 MB / 85k-row export parses in about 3 s in tests (without the DB writes).
- **Dedupe:** `generation_id` = `Billing Item ID`, with the unique key `(user_id, generation_id)` and `ON CONFLICT DO NOTHING`. Duplicates within one file are dropped too. Importing the same or an overlapping export again adds nothing twice, and the toast says how many rows were already stored.
- **Mapping**:

  | activity_rows | from the export |
  |---|---|
  | `provider_source` / `provider_name` / `app_name` | `cursor` → Cursor, `grok-bot` → Grok Bot |
  | `model_permaslug` | `Model`, or the product when it's empty (Grok Bot has no model column) |
  | `tokens_prompt` | `prompt-text-tokens + cached-prompt-text-tokens + cache-write-text-tokens` (total input) |
  | `tokens_cached` | `cached-prompt-text-tokens` |
  | `tokens_cache_write` (new) | `cache-write-text-tokens` |
  | `tokens_completion` | `completion-text-tokens` |
  | `cost_total` | `Pricing Contracted` (USD) |
  | `billing_type` (new) | `Usage Type`: `included` / `on_demand` / `credits` |

- **Skipped rows:** no Billing Item ID, an invalid time, an unknown product, or a currency other than USD. Their count is shown after the import.
- **Not stored:** `User Email`, `Principal ID`, `Principal Type`, `Charge Category`.
- **RLS:** rows are inserted by the signed-in user, so the existing `user_id = auth.uid()` policies apply. No service role is involved. On Free, rows older than 30 days are not stored (same as the OpenRouter import).
- **Dashboard:** when imported rows are present, a "Cursor a Grok Bot: tokeny a tarif" card shows reads from cache / writes to cache / fresh input / output, and the cost in the plan vs over the plan.
- **Migration:** `supabase/migrations/20261030150000_usage_export_import.sql` widens the `provider_source` CHECK and adds the two new columns. **Not applied anywhere yet.**
- **Tests:** `src/test/usage-export.test.ts`, using the anonymized fixture `src/test/fixtures/usage-export-sample.csv`. The fixture IDs are made up and its email is example.com.
