// Provider API keys live in Supabase Vault (migration 20261030140000_provider_keys_vault.sql).
// These helpers are the only code that writes or reads them; every call needs the service-role
// client, because the RPCs are not executable by anon/authenticated.
//
// Never log the values returned here and never send them back to the browser.

/** Minimal shape of the supabase-js client used here (keeps this file testable under Vitest). */
export interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface SavedCredential {
  id: string;
  provider: string;
  label: string;
  key_preview: string;
  enabled: boolean;
  organization_id: string | null;
  last_synced_at: string | null;
}

export class MissingKeyError extends Error {
  constructor() {
    super("No API key stored for this connection. Save the key again in Settings.");
  }
}

/** Same masking as public.mask_provider_key in SQL: bullets + last 4 characters. */
export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return "";
  if (k.length < 12) return "••••";
  return "••••" + k.slice(-4);
}

/** Create or rotate (user, provider, label) and encrypt its key in Vault, atomically. */
export async function saveCredentialKey(
  svc: RpcClient,
  params: { userId: string; provider: string; label: string; apiKey: string; organizationId: string | null },
): Promise<SavedCredential> {
  const { data, error } = await svc.rpc("save_provider_credential", {
    p_user_id: params.userId,
    p_provider: params.provider,
    p_label: params.label,
    p_api_key: params.apiKey,
    p_organization_id: params.organizationId,
  });
  if (error) throw new Error(`save_provider_credential failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("save_provider_credential returned no row");
  return row as SavedCredential;
}

/** Decrypted key for one credential row. Throws MissingKeyError when none is stored. */
export async function loadCredentialKey(svc: RpcClient, credentialId: string): Promise<string> {
  const { data, error } = await svc.rpc("get_provider_credential_key", { p_credential_id: credentialId });
  if (error) throw new Error(`get_provider_credential_key failed: ${error.message}`);
  if (typeof data !== "string" || data.length === 0) throw new MissingKeyError();
  return data;
}

/** Delete one credential, or all of a user's credentials (credentialId omitted), with their Vault secrets. */
export async function deleteCredentials(svc: RpcClient, userId: string, credentialId?: string): Promise<number> {
  const { data, error } = await svc.rpc("delete_provider_credentials", {
    p_user_id: userId,
    p_credential_id: credentialId ?? null,
  });
  if (error) throw new Error(`delete_provider_credentials failed: ${error.message}`);
  return typeof data === "number" ? data : 0;
}
