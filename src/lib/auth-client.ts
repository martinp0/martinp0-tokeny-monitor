// Minimal Better Auth client for Neon Auth, talking to our same-origin proxy (/api/auth/*).
// Session = httpOnly first-party cookies; JS never sees a token.
type Listener = (s: AuthSession | null) => void;

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
}
export interface AuthSession {
  user: AuthUser;
}

export class AuthError extends Error {
  constructor(message: string, public status: number, public code: string | null) {
    super(message);
  }
}

const VERIFIER = "neon_auth_session_verifier";
const listeners = new Set<Listener>();
let current: AuthSession | null | undefined;
let inflight: Promise<AuthSession | null> | null = null;

async function call<T>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const res = await fetch(`/api/auth/${path}`, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new AuthError(json?.message || json?.error || `HTTP ${res.status}`, res.status, json?.code ?? null);
  }
  return json as T;
}

const HINT_KEY = "tokeny.signedIn";

/** Non-secret hint so public pages can skip the session round-trip for anonymous visitors. */
export function maybeSignedIn(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function emit(s: AuthSession | null) {
  current = s;
  try {
    if (s) localStorage.setItem(HINT_KEY, "1");
    else localStorage.removeItem(HINT_KEY);
  } catch {
    /* storage unavailable */
  }
  for (const l of listeners) l(s);
}

function toSession(data: any): AuthSession | null {
  const u = data?.user;
  if (!u?.id) return null;
  return { user: { id: u.id, email: u.email ?? "", name: u.name ?? null, image: u.image ?? null, emailVerified: !!u.emailVerified } };
}

export const authClient = {
  /** Current session (cached). After an OAuth redirect this also completes the sign-in. */
  async getSession(force = false): Promise<AuthSession | null> {
    if (current !== undefined && !force && !hasVerifier()) return current;
    inflight ??= (async () => {
      try {
        const verifier = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(VERIFIER) : null;
        const data = await call<any>(`get-session${verifier ? `?${VERIFIER}=${encodeURIComponent(verifier)}` : ""}`);
        if (verifier) {
          const url = new URL(window.location.href);
          url.searchParams.delete(VERIFIER);
          window.history.replaceState(window.history.state, "", url.href);
        }
        const s = toSession(data);
        emit(s);
        return s;
      } catch {
        emit(null);
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  onChange(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async signInEmail(email: string, password: string) {
    await call("sign-in/email", { email, password, rememberMe: true });
    return this.getSession(true);
  },

  async signUpEmail(email: string, password: string, name: string) {
    await call("sign-up/email", { email, password, name, callbackURL: `${window.location.origin}/dashboard` });
    return this.getSession(true);
  },

  /** Redirects to Google/Apple; Neon Auth sends the user back to `callbackPath` with a verifier. */
  async signInSocial(provider: "google" | "apple", callbackURL = `${window.location.origin}/auth/callback`) {
    const r = await call<{ url?: string }>("sign-in/social", {
      provider,
      callbackURL,
      errorCallbackURL: `${window.location.origin}/auth/callback`,
    });
    if (!r?.url) throw new AuthError("Přihlášení přes poskytovatele se nepodařilo spustit.", 500, null);
    window.location.assign(r.url);
  },

  async signOut() {
    try {
      await call("sign-out", {});
    } finally {
      emit(null);
    }
  },

  /** Sends a 6-digit reset code by e-mail (Neon Auth email OTP). */
  async requestPasswordReset(email: string) {
    try {
      await call("email-otp/request-password-reset", { email });
    } catch (e) {
      if (e instanceof AuthError && e.status === 404) await call("forget-password/email-otp", { email });
      else throw e;
    }
  },

  async resetPassword(email: string, otp: string, password: string) {
    await call("email-otp/reset-password", { email, otp, password });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    await call("change-password", { currentPassword, newPassword, revokeOtherSessions: true });
  },

  async updateName(name: string) {
    await call("update-user", { name });
    return this.getSession(true);
  },
};

function hasVerifier() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has(VERIFIER);
}

/** Czech message for common Better Auth error codes. */
export function authErrorMessage(e: unknown): string {
  const code = e instanceof AuthError ? e.code : null;
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Nesprávný e-mail nebo heslo.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Účet s tímto e-mailem už existuje. Přihlas se.";
    case "PASSWORD_TOO_SHORT":
      return "Heslo je příliš krátké (min. 8 znaků).";
    case "PASSWORD_TOO_LONG":
      return "Heslo je příliš dlouhé.";
    case "INVALID_OTP":
    case "OTP_EXPIRED":
      return "Kód je neplatný nebo vypršel. Požádej o nový.";
    case "TOO_MANY_ATTEMPTS":
      return "Příliš mnoho pokusů, zkus to za chvíli.";
    case "EMAIL_NOT_VERIFIED":
      return "Nejdřív potvrď svůj e-mail.";
    default:
      return e instanceof Error && e.message ? e.message : "Něco se pokazilo, zkus to znovu.";
  }
}
