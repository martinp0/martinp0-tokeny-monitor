// Same-origin JSON client for the Tokeny API (/api/*, a Vercel Function). Auth is the
// first-party session cookie set by /api/auth/* — nothing secret is stored in JS.
import { PRO_REQUIRED_ERROR } from "@/lib/plan";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown> | null,
  ) {
    super(message);
  }
  get proRequired(): boolean {
    return this.status === 403 && this.body?.error === PRO_REQUIRED_ERROR;
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
  });
  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg = (body && (typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : null)) || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

/** Pro gate helper shared by the components that used to read `{ error: "pro_required" }` bodies. */
export function isProRequiredError(e: unknown): boolean {
  return e instanceof ApiError && e.proRequired;
}
