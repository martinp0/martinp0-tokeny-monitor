/**
 * Supabase "Send Email" auth hook helpers — PURE (WebCrypto only), unit-tested with Vitest.
 *
 * - Signature: Standard Webhooks (headers webhook-id / webhook-timestamp / webhook-signature,
 *   HMAC-SHA256 over `${id}.${timestamp}.${body}` keyed with the base64 part of `v1,whsec_<base64>`).
 * - Links: the hook payload carries `token_hash`; the email link must hit GoTrue's
 *   /auth/v1/verify with it (the bare `redirect_to` has no token and cannot confirm anything).
 * - email_change: the hash field names are reversed (see Supabase docs): `token_hash_new` goes
 *   with the CURRENT address, `token_hash` with the NEW address.
 */

export const TOLERANCE_SECONDS = 5 * 60;

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Secret as configured in Supabase ("v1,whsec_<base64>"), or just the base64 part. */
export function hookSecretBytes(secret: string): Uint8Array<ArrayBuffer> {
  const b64 = secret.trim().replace(/^v1,/, "").replace(/^whsec_/, "");
  return b64ToBytes(b64);
}

export async function signStandardWebhook(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", hookSecretBytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${bytesToB64(new Uint8Array(sig))}`;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export async function verifyStandardWebhook(
  secret: string | undefined,
  headers: { get(name: string): string | null },
  body: string,
  now: Date = new Date(),
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: "secret_not_configured" };
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return { ok: false, reason: "missing_headers" };
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(now.getTime() / 1000 - tsNum) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp_out_of_tolerance" };
  }
  let expected: string;
  try {
    expected = (await signStandardWebhook(secret, id, ts, body)).slice(3);
  } catch {
    return { ok: false, reason: "invalid_secret" };
  }
  // Header may contain several space-separated "v1,<sig>" entries (secret rotation).
  const ok = sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",", 2);
    return version === "v1" && !!sig && timingSafeEqual(sig, expected);
  });
  return ok ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}

/** GoTrue verify link: consumes token_hash, then redirects to redirect_to with the session. */
export function buildVerifyUrl(supabaseUrl: string, tokenHash: string, type: string, redirectTo: string): string {
  const params = new URLSearchParams({ token: tokenHash, type });
  if (redirectTo) params.set("redirect_to", redirectTo);
  return `${supabaseUrl.replace(/\/$/, "")}/auth/v1/verify?${params.toString()}`;
}

export interface HookPayload {
  user?: { email?: string; new_email?: string } | null;
  email_data?: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
    email_action_type?: string;
    old_email?: string;
  } | null;
}

export const LINK_EMAIL_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change"] as const;
export const TEMPLATE_TYPES = [...LINK_EMAIL_TYPES, "reauthentication"] as const;

export interface PlannedEmail {
  type: string;
  to: string;
  token: string;
  confirmationUrl: string;
  oldEmail: string;
  newEmail: string;
}

/**
 * Which emails to send for a hook payload. Returns [] for action types we do not template
 * (e.g. *_notification) — the caller acknowledges those without sending.
 */
export function planAuthEmails(payload: HookPayload, supabaseUrl: string, fallbackRedirect: string): PlannedEmail[] {
  const d = payload.email_data ?? {};
  const type = d.email_action_type ?? "";
  const currentEmail = payload.user?.email ?? "";
  const redirectTo = d.redirect_to || d.site_url || fallbackRedirect;
  if (!(TEMPLATE_TYPES as readonly string[]).includes(type)) return [];

  if (type === "reauthentication") {
    return currentEmail ? [{ type, to: currentEmail, token: d.token ?? "", confirmationUrl: "", oldEmail: "", newEmail: "" }] : [];
  }

  if (type === "email_change") {
    const newEmail = payload.user?.new_email ?? "";
    const out: PlannedEmail[] = [];
    const secure = !!d.token_hash && !!d.token_hash_new;
    if (secure) {
      // Current address: token + token_hash_new. New address: token_new + token_hash.
      if (currentEmail) {
        out.push({ type, to: currentEmail, token: d.token ?? "", confirmationUrl: buildVerifyUrl(supabaseUrl, d.token_hash_new!, type, redirectTo), oldEmail: currentEmail, newEmail });
      }
      if (newEmail) {
        out.push({ type, to: newEmail, token: d.token_new ?? "", confirmationUrl: buildVerifyUrl(supabaseUrl, d.token_hash!, type, redirectTo), oldEmail: currentEmail, newEmail });
      }
    } else {
      const hash = d.token_hash || d.token_hash_new || "";
      const to = newEmail || currentEmail;
      if (hash && to) {
        out.push({ type, to, token: d.token || d.token_new || "", confirmationUrl: buildVerifyUrl(supabaseUrl, hash, type, redirectTo), oldEmail: currentEmail, newEmail: to });
      }
    }
    return out;
  }

  if (!currentEmail || !d.token_hash) return [];
  return [{
    type,
    to: currentEmail,
    token: d.token ?? "",
    confirmationUrl: buildVerifyUrl(supabaseUrl, d.token_hash, type, redirectTo),
    oldEmail: "",
    newEmail: currentEmail,
  }];
}
