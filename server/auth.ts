// Who is calling? Three ways in, all resolved server-side to a Neon Auth user id:
//   1. Browser: first-party session cookies set by our same-origin proxy (/api/auth/* → Neon Auth).
//   2. Native apps: "Authorization: Bearer <Neon Auth JWT>" (EdDSA, verified against the JWKS).
//   3. Personal tokens "orm_…" (MCP / API clients): sha256 looked up in mcp_tokens (see repo.ts).
import { handleAuthProxyRequest } from "@neon/auth/server";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function authBaseUrl(): string {
  const url = process.env.NEON_AUTH_BASE_URL;
  if (!url) throw new Error("NEON_AUTH_BASE_URL is not configured");
  return url.replace(/\/$/, "");
}

export function cookieSecret(): string {
  const s = process.env.NEON_AUTH_COOKIE_SECRET ?? "";
  if (s.length < 32) throw new Error("NEON_AUTH_COOKIE_SECRET must be at least 32 characters");
  return s;
}

/** Same-origin proxy for every Better Auth endpoint (sign-in, sign-up, get-session, token, …). */
export function proxyAuth(request: Request, path: string): Promise<Response> {
  return handleAuthProxyRequest({
    request,
    path,
    baseUrl: authBaseUrl(),
    cookieSecret: cookieSecret(),
    sameSite: "lax", // lax: the OAuth return is a top-level cross-site navigation
  });
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function userFromJwt(token: string): Promise<AuthUser | null> {
  jwks ??= createRemoteJWKSet(new URL(`${authBaseUrl()}/.well-known/jwks.json`));
  try {
    const { payload } = await jwtVerify(token, jwks);
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub || !UUID_RE.test(sub)) return null;
    return {
      id: sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
      image: typeof payload.image === "string" ? payload.image : null,
      emailVerified: payload.emailVerified === true,
    };
  } catch {
    return null;
  }
}

async function userFromCookies(req: Request): Promise<AuthUser | null> {
  const cookie = req.headers.get("cookie");
  if (!cookie || !cookie.includes("neon-auth")) return null;
  const url = new URL(req.url);
  const headers = new Headers({ cookie });
  const origin = req.headers.get("origin");
  if (origin) headers.set("origin", origin);
  const probe = new Request(`${url.origin}/api/auth/get-session`, { method: "GET", headers });
  try {
    const res = await proxyAuth(probe, "get-session");
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { user?: Record<string, unknown> } | null;
    const u = body?.user;
    if (!u || typeof u.id !== "string" || !UUID_RE.test(u.id)) return null;
    return {
      id: u.id,
      email: typeof u.email === "string" ? u.email : null,
      name: typeof u.name === "string" ? u.name : null,
      image: typeof u.image === "string" ? u.image : null,
      emailVerified: u.emailVerified === true,
    };
  } catch (e) {
    console.error("session lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export function bearerToken(req: Request): string | null {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i);
  return m ? m[1] : null;
}

/** Signed-in user (cookie session or Bearer JWT). Personal orm_ tokens are NOT accepted here. */
export async function sessionUser(req: Request): Promise<AuthUser | null> {
  const bearer = bearerToken(req);
  if (bearer && !bearer.startsWith("orm_")) return userFromJwt(bearer);
  return userFromCookies(req);
}
