// HTTP handler for a user-initiated sync of one of *their own* stored credentials.
//
// Body: { credential_id: string, starting_at?: ISO, ending_at?: ISO, bucket_width?: '1d'|'1h' }
// The credential must belong to the caller (checked server-side) and match the provider of the
// function. Provider API keys come only from provider_credentials — never from a global secret.
import { corsHeaders, getCallingUser, json, serviceClient } from "./http.ts";
import { runCredentialSync, type Credential } from "./sync-runner.ts";
import type { SyncProvider } from "./sync-core.ts";
import { getIsPro, proRequired } from "./entitlements.ts";
import { syncableCredentialIds } from "./plan.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function handleUserSync(req: Request, provider: SyncProvider): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await getCallingUser(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const credentialId = String(body?.credential_id ?? "");
    if (!UUID_RE.test(credentialId)) return json({ error: "credential_id is required" }, 400);

    const svc = serviceClient();
    const { data: cred, error } = await svc
      .from("provider_credentials")
      .select("id, user_id, provider, api_key, enabled, last_synced_at")
      .eq("id", credentialId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!cred) return json({ error: "Credential not found" }, 404);
    if (cred.provider !== provider) return json({ error: `Wrong provider for sync-${provider}` }, 400);
    if (!cred.enabled) return json({ error: "Credential is disabled" }, 400);

    // Free plan: only the user's first connected provider syncs (others stay stored after a
    // downgrade, but are inactive until they upgrade again).
    if (!(await getIsPro(svc, user.id))) {
      const { data: all, error: allErr } = await svc
        .from("provider_credentials")
        .select("id, created_at")
        .eq("user_id", user.id);
      if (allErr) throw allErr;
      if (!syncableCredentialIds(all ?? [], false).has(cred.id)) return proRequired("multi_provider");
    }

    const end = parseDate(body?.ending_at ?? body?.end_time);
    const start = parseDate(body?.starting_at ?? body?.start_time);
    const outcome = await runCredentialSync(svc, cred as Credential, {
      start,
      end,
      bucketWidth: body?.bucket_width === "1h" ? "1h" : "1d",
    });
    if (!outcome.ok) return json({ error: outcome.error, inserted: outcome.inserted, failed: outcome.failed }, outcome.status);
    return json({ success: true, provider, fetched: outcome.fetched, inserted: outcome.inserted, failed: 0 });
  } catch (e) {
    console.error(`sync-${provider} error`, e instanceof Error ? e.message : e);
    return json({ error: "Internal server error" }, 500);
  }
}
