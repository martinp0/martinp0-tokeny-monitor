// Scheduled background sync for every user's enabled provider credentials.
//
// Invoked by pg_cron (see migration *_auto_sync_cron.sql) via pg_net with the header
// `x-auto-sync-secret: <AUTO_SYNC_SECRET>`. Not callable by end users (verify_jwt = false,
// authenticated by the shared secret only).
//
// Each run picks the credentials that are due (never attempted, or last attempted more than
// MIN_INTERVAL ago), oldest first, and syncs them sequentially until the time budget is spent.
// Incremental window: 3 days back for already-synced credentials, 30 days for the first sync.
// Rows are always written with the credential owner's user_id.
import { corsHeaders, json, safeEqual, serviceClient } from "../_shared/http.ts";
import { runCredentialSync, type Credential } from "../_shared/sync-runner.ts";
import { SUPPORTED_SYNC_PROVIDERS } from "../_shared/sync-core.ts";

const MIN_INTERVAL_MS = 55 * 60 * 1000;
const TIME_BUDGET_MS = 110_000; // stay well below the edge function wall-clock limit
const MAX_PER_RUN = 50;
const DAY = 86_400_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("AUTO_SYNC_SECRET") ?? "";
  const provided = req.headers.get("x-auto-sync-secret") ?? "";
  if (!expected || expected.length < 24) {
    console.error("auto-sync: AUTO_SYNC_SECRET is not configured");
    return json({ error: "Not configured" }, 503);
  }
  if (!safeEqual(provided, expected)) return json({ error: "Unauthorized" }, 401);

  const started = Date.now();
  const svc = serviceClient();
  const dueBefore = new Date(Date.now() - MIN_INTERVAL_MS).toISOString();

  const { data: creds, error } = await svc
    .from("provider_credentials")
    .select("id, user_id, provider, api_key, enabled, last_synced_at")
    .eq("enabled", true)
    .in("provider", [...SUPPORTED_SYNC_PROVIDERS])
    // last_sync_attempt_at (not last_synced_at) so a permanently failing key is retried at most
    // once per interval and cannot starve healthy credentials.
    .or(`last_sync_attempt_at.is.null,last_sync_attempt_at.lt.${dueBefore}`)
    .order("last_sync_attempt_at", { ascending: true, nullsFirst: true })
    .limit(MAX_PER_RUN);
  if (error) {
    console.error("auto-sync: failed to load credentials", error.message);
    return json({ error: "Internal server error" }, 500);
  }

  const results: Array<{ credential_id: string; provider: string; ok: boolean; inserted: number; error?: string }> = [];
  for (const cred of (creds ?? []) as Credential[]) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const end = new Date();
    const start = cred.last_synced_at
      ? new Date(Math.max(new Date(cred.last_synced_at).getTime() - 3 * DAY, end.getTime() - 30 * DAY))
      : new Date(end.getTime() - 30 * DAY);
    const out = await runCredentialSync(svc, cred, { start, end, bucketWidth: "1d" });
    results.push({ credential_id: cred.id, provider: cred.provider, ok: out.ok, inserted: out.inserted, error: out.error?.slice(0, 200) });
  }

  const summary = {
    processed: results.length,
    due: creds?.length ?? 0,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    elapsed_ms: Date.now() - started,
  };
  console.log("auto-sync done", JSON.stringify(summary));
  // Never echo user data or keys back; ids + counts only.
  return json({ ...summary, results });
});
