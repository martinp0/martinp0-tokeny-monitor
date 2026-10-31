/**
 * OAuth / email-link redirect helpers.
 *
 * All redirect URLs are derived from window.location.origin so the same build works on
 * https://tokeny.martinpohl.cz (primary), https://tokeny.pohl.uk (transitional), Vercel previews
 * and localhost — as long as the origin is a trusted domain in Neon Auth.
 */
export const AUTH_CALLBACK_PATH = "/auth/callback";
export const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export function authCallbackUrl(origin: string, next?: string): string {
  const url = new URL(AUTH_CALLBACK_PATH, origin);
  const safe = sanitizeNext(next);
  if (safe !== DEFAULT_POST_LOGIN_PATH) url.searchParams.set("next", safe);
  return url.toString();
}

/** Only allow same-origin relative paths (prevents open redirects via ?next=). */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return DEFAULT_POST_LOGIN_PATH;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return DEFAULT_POST_LOGIN_PATH;
  return next;
}

/** Error returned by the auth server in the query string or the URL fragment, if any. */
export function readAuthError(search: string, hash: string): string | null {
  for (const raw of [search, hash.startsWith("#") ? hash.slice(1) : hash]) {
    const params = new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
    const desc = params.get("error_description") ?? params.get("error");
    if (desc) return desc.replace(/\+/g, " ");
  }
  return null;
}
