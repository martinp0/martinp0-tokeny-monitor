// Tokeny API: one Hono app behind a single Vercel Function (api/index.ts), same origin as the SPA.
// Authorization model: every handler resolves the caller (server/auth.ts) and passes that user id
// to server/repo.ts; there is no client-side database access and no row-level security to rely on.
import { Hono, type Context } from "hono";
import type { Db } from "./db.js";
import { getDb } from "./db.js";
import { bearerToken, proxyAuth, sessionUser, UUID_RE, type AuthUser } from "./auth.js";
import * as repo from "./repo.js";
import { canAddProvider, freeHistoryFloor, proRequiredBody, type ProFeature } from "./lib/plan.js";
import { ALLOWED_PROVIDERS, MissingKeyError, validateAiKeyShape, validateKeyShape } from "./lib/credential-keys.js";
import { runCredentialSync } from "./lib/sync-runner.js";
import { deleteAccount } from "./lib/account-deletion.js";
import { createMcpApp } from "./mcp.js";
import { buildSvg } from "./og.js";
import { usageSummary } from "./usage-summary.js";
import { aiError, chatAgent, funAi, isFunMode, verifyAnthropicKey } from "./ai.js";
import { createCheckout, createPortal, stripeBilling, stripeWebhook, subscriptionStatus } from "./stripe.js";
import { refreshExchangeRate, runDaily } from "./cron.js";
import { EncryptionKeyError } from "./crypto.js";

type Env = { Variables: { user: AuthUser } };

export interface AppOptions {
  db?: () => Db;
  /** Test hook: resolve the session user without Neon Auth. */
  sessionUser?: (req: Request) => Promise<AuthUser | null>;
}

const MAX_SHARED_ROWS = 50_000;
const MAX_PAGE = 5_000;

export function createApp(opts: AppOptions = {}) {
  const db = opts.db ?? getDb;
  const resolveUser = opts.sessionUser ?? sessionUser;
  const app = new Hono<Env>().basePath("/api");

  const pro = (feature: ProFeature) => (c: Context) => c.json(proRequiredBody(feature), 403);

  app.onError((err, c) => {
    if (err instanceof EncryptionKeyError) {
      console.error("credentials encryption key problem", err.message);
      return c.json({ error: "Server is not configured for API keys" }, 503);
    }
    console.error("api error", c.req.method, c.req.path, err instanceof Error ? err.message : err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.use("*", async (c, next) => {
    await next();
    if (!c.res.headers.has("Cache-Control")) c.res.headers.set("Cache-Control", "no-store");
  });

  // ------------------------------------------------------------------ auth proxy (Better Auth)
  app.all("/auth/*", async (c) => {
    const path = c.req.path.replace(/^\/api\/auth\/?/, "");
    return proxyAuth(c.req.raw, path);
  });

  // ------------------------------------------------------------------ public
  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/exchange-rate", async (c) => {
    let rate = await repo.getExchangeRate(db());
    const stale = !rate || Date.now() - new Date(rate.fetched_at).getTime() > 36 * 3_600_000;
    if (stale) {
      try {
        await refreshExchangeRate(db());
        rate = await repo.getExchangeRate(db());
      } catch (e) {
        console.warn("exchange rate refresh failed", e instanceof Error ? e.message : e);
      }
    }
    c.header("Cache-Control", "public, max-age=600");
    return c.json({ rate: rate?.rate ?? 23.5, date: rate?.source_date ?? null });
  });

  app.get("/shared/:token", async (c) => {
    const token = c.req.param("token");
    if (!token || token.length < 10) return c.json({ error: "Invalid token" }, 400);
    const share = await repo.shareByToken(db(), token);
    if (!share) return c.json({ error: "Share not found" }, 404);
    if (share.expires_at && new Date(share.expires_at) < new Date()) return c.json({ error: "Share expired" }, 410);
    const historyFrom = await repo.historyFloor(db(), share.user_id);
    const rows = await repo.listActivity(db(), share.user_id, { offset: 0, limit: MAX_SHARED_ROWS + 1, from: historyFrom });
    const truncated = rows.length > MAX_SHARED_ROWS;
    return c.json({
      label: share.label,
      filters: share.filters,
      owner: (await repo.displayName(db(), share.user_id)) || "Anonym",
      created_at: share.created_at,
      rows: truncated ? rows.slice(0, MAX_SHARED_ROWS) : rows,
      truncated,
      history_from: historyFrom,
    });
  });

  app.get("/og-dashboard", async (c) => {
    const token = c.req.query("token") ?? "";
    if (token.length < 10) return c.text("Invalid token", 400);
    const share = await repo.shareByToken(db(), token);
    if (!share) return c.text("Not found", 404);
    if (share.expires_at && new Date(share.expires_at) < new Date()) return c.text("Expired", 410);
    const byModel = await repo.aggregateActivity(db(), share.user_id, { groupBy: "model", from: await repo.historyFloor(db(), share.user_id) });
    let totalCost = 0, totalTokens = 0, totalRequests = 0;
    const modelMap: Record<string, number> = {};
    for (const r of byModel) {
      totalCost += Number(r.cost_total || 0);
      totalTokens += Number(r.tokens_prompt || 0) + Number(r.tokens_completion || 0);
      totalRequests += Number(r.request_count || 0);
      modelMap[r.bucket || "unknown"] = (modelMap[r.bucket || "unknown"] || 0) + Number(r.cost_total || 0);
    }
    const topModel = (Object.entries(modelMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "").split("/").pop() || "—";
    const svg = buildSvg({
      label: share.label || "Sdílený dashboard",
      owner: (await repo.displayName(db(), share.user_id)) || "Anonym",
      totalCost, totalRequests, totalTokens, topModel,
    });
    return c.body(svg, 200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
      "Access-Control-Allow-Origin": "*",
    });
  });

  app.post("/stripe-webhook", async (c) => {
    const r = await stripeWebhook(db(), await c.req.text(), c.req.header("stripe-signature") ?? null);
    return c.json(r.body as object, r.status as 200);
  });

  app.get("/cron/daily", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) return c.json({ error: "Unauthorized" }, 401);
    return c.json(await runDaily(db()));
  });

  // MCP (personal orm_ tokens, Pro). GET/DELETE → 405, POST without a token → 401.
  const mcpApp = createMcpApp({
    authUser: async (req) => {
      const t = bearerToken(req);
      return t ? repo.userIdByMcpToken(db(), t) : null;
    },
    userIsPro: (userId) => repo.isPro(db(), userId),
    db,
  });
  app.all("/mcp", (c) => mcpApp.fetch(c.req.raw));
  app.all("/mcp/*", (c) => mcpApp.fetch(c.req.raw));

  // Native apps & widgets: Neon Auth session cookie or JWT (any plan), or orm_ token (Pro).
  app.get("/usage-summary", async (c) => {
    const t = bearerToken(c.req.raw);
    let userId: string | null = null;
    let isPro = false;
    if (t?.startsWith("orm_")) {
      userId = await repo.userIdByMcpToken(db(), t);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);
      if (!(await repo.isPro(db(), userId))) return c.json(proRequiredBody("mcp"), 403);
      isPro = true;
    } else {
      const u = await resolveUser(c.req.raw);
      if (!u) return c.json({ error: "Unauthorized" }, 401);
      userId = u.id;
      isPro = await repo.isPro(db(), userId);
    }
    return c.json(await usageSummary(db(), userId, isPro, c.req.query("tz") ?? null));
  });

  // ------------------------------------------------------------------ signed-in routes
  const authed = new Hono<Env>();
  authed.use("*", async (c, next) => {
    // Cookie-authenticated writes must come from our own origin (SameSite=Lax already blocks most CSRF).
    if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) && !bearerToken(c.req.raw)) {
      const origin = c.req.header("origin");
      if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "Forbidden origin" }, 403);
    }
    const user = await resolveUser(c.req.raw);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    c.set("user", user);
    await next();
  });

  authed.get("/me", async (c) => {
    const u = c.get("user");
    const [profile, subscription] = await Promise.all([
      repo.ensureProfile(db(), u.id, u.name || (u.email ? u.email.split("@")[0] : null)),
      subscriptionStatus(db(), u.id),
    ]);
    return c.json({
      user: { id: u.id, email: u.email, name: u.name, image: u.image, emailVerified: u.emailVerified },
      profile,
      subscription,
      historyFrom: subscription.isPro ? null : freeHistoryFloor(),
    });
  });

  authed.patch("/profile", async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const patch: { display_name?: string | null; avatar_url?: string | null } = {};
    if (typeof b.display_name === "string") patch.display_name = b.display_name.trim().slice(0, 80) || null;
    if (b.avatar_url === null || typeof b.avatar_url === "string") {
      const v = typeof b.avatar_url === "string" ? b.avatar_url.trim().slice(0, 500) : null;
      if (v && !/^https:\/\//.test(v)) return c.json({ error: "avatar_url must be https" }, 400);
      patch.avatar_url = v || null;
    }
    return c.json({ profile: await repo.updateProfile(db(), c.get("user").id, patch) });
  });

  // activity rows -------------------------------------------------------------
  authed.get("/activity", async (c) => {
    const userId = c.get("user").id;
    const offset = Math.max(0, Number(c.req.query("offset")) || 0);
    const limit = Math.max(1, Math.min(Number(c.req.query("limit")) || 1000, MAX_PAGE));
    const from = await repo.historyFloor(db(), userId);
    const rows = await repo.listActivity(db(), userId, { offset, limit, from });
    return c.json({ rows, historyFrom: from });
  });

  authed.post("/activity/import", async (c) => {
    const b = await c.req.json().catch(() => null);
    if (!b || !Array.isArray(b.rows)) return c.json({ error: "rows must be an array" }, 400);
    if (b.rows.length > 2000) return c.json({ error: "max 2000 rows per request" }, 413);
    const n = await repo.upsertActivityBatched(db(), c.get("user").id, b.rows, b.ignoreDuplicates ? "ignore" : "upsert");
    return c.json({ written: n });
  });

  authed.delete("/activity", async (c) => {
    return c.json({ deleted: await repo.deleteActivity(db(), c.get("user").id) });
  });

  // provider credentials --------------------------------------------------------
  authed.get("/credentials", async (c) => c.json({ credentials: await repo.listCredentials(db(), c.get("user").id) }));

  authed.post("/credentials", async (c) => {
    const userId = c.get("user").id;
    const b = await c.req.json().catch(() => ({}));
    const provider = String(b.provider ?? "").toLowerCase();
    const label = String(b.label ?? "Default").slice(0, 60) || "Default";
    const apiKey = String(b.api_key ?? "").trim();
    const organizationId = b.organization_id ? String(b.organization_id).slice(0, 120) : null;
    if (!ALLOWED_PROVIDERS.has(provider)) return c.json({ error: "Unsupported provider" }, 400);
    const shapeError = validateKeyShape(provider, apiKey);
    if (shapeError) return c.json({ error: shapeError }, 400);
    if (!(await repo.isPro(db(), userId))) {
      const list = await repo.listCredentials(db(), userId);
      const replacing = list.find((x) => x.provider === provider && x.label === label)?.id ?? null;
      if (!canAddProvider(false, list.map((x) => x.id as string), replacing)) return pro("multi_provider")(c);
    }
    const credential = await repo.saveCredential(db(), userId, { provider, label, apiKey, organizationId });
    return c.json({ credential });
  });

  authed.patch("/credentials/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return c.json({ error: "Invalid id" }, 400);
    const b = await c.req.json().catch(() => ({}));
    if (typeof b.enabled !== "boolean") return c.json({ error: "enabled must be boolean" }, 400);
    const ok = await repo.setCredentialEnabled(db(), c.get("user").id, id, b.enabled);
    return ok ? c.json({ success: true }) : c.json({ error: "Credential not found" }, 404);
  });

  authed.delete("/credentials/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return c.json({ error: "Invalid id" }, 400);
    const ok = await repo.deleteCredential(db(), c.get("user").id, id);
    return ok ? c.json({ success: true }) : c.json({ error: "Credential not found" }, 404);
  });

  authed.post("/credentials/:id/sync", async (c) => {
    const userId = c.get("user").id;
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return c.json({ error: "credential_id is required" }, 400);
    const cred = await repo.credentialForSync(db(), userId, id);
    if (!cred) return c.json({ error: "Credential not found" }, 404);
    if (!cred.enabled) return c.json({ error: "Credential is disabled" }, 400);
    const isPro = await repo.isPro(db(), userId);
    if (!(await repo.canSyncCredential(db(), userId, id, isPro))) return pro("multi_provider")(c);
    const b = await c.req.json().catch(() => ({}));
    const parseDate = (v: unknown) => {
      if (typeof v !== "string" || !v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    let apiKey: string;
    try {
      apiKey = repo.decryptCredential(cred);
    } catch (e) {
      if (e instanceof MissingKeyError) return c.json({ error: e.message }, 400);
      throw e;
    }
    const outcome = await runCredentialSync(
      db(),
      { id: cred.id, user_id: userId, provider: cred.provider, enabled: cred.enabled, last_synced_at: cred.last_synced_at, api_key: apiKey },
      { start: parseDate(b?.starting_at), end: parseDate(b?.ending_at), bucketWidth: b?.bucket_width === "1h" ? "1h" : "1d" },
    );
    if (!outcome.ok) return c.json({ error: outcome.error, inserted: outcome.inserted, failed: outcome.failed }, outcome.status as 400);
    return c.json({ success: true, provider: outcome.provider, fetched: outcome.fetched, inserted: outcome.inserted, failed: 0 });
  });

  // budget alert (write = Pro) ------------------------------------------------------
  authed.get("/budget-alert", async (c) => c.json({ alert: await repo.getBudgetAlert(db(), c.get("user").id) }));

  authed.put("/budget-alert", async (c) => {
    const userId = c.get("user").id;
    if (!(await repo.isPro(db(), userId))) return pro("budget_alerts")(c);
    const b = await c.req.json().catch(() => ({}));
    const budget = Number(b.monthly_budget_usd);
    const pct = Math.round(Number(b.threshold_pct ?? 80));
    if (!Number.isFinite(budget) || budget <= 0 || budget > 1_000_000) return c.json({ error: "Invalid budget" }, 400);
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) return c.json({ error: "Invalid threshold" }, 400);
    const email = typeof b.notify_email === "string" && b.notify_email.trim() ? b.notify_email.trim().slice(0, 254) : null;
    const alert = await repo.saveBudgetAlert(db(), userId, {
      monthly_budget_usd: budget, threshold_pct: pct, notify_email: email, enabled: b.enabled !== false,
    });
    return c.json({ alert });
  });

  authed.delete("/budget-alert", async (c) => {
    await repo.deleteBudgetAlert(db(), c.get("user").id);
    return c.json({ success: true });
  });

  // personal tokens (create = Pro) ------------------------------------------------------
  authed.get("/mcp-tokens", async (c) => c.json({ tokens: await repo.listMcpTokens(db(), c.get("user").id) }));

  authed.post("/mcp-tokens", async (c) => {
    const userId = c.get("user").id;
    if (!(await repo.isPro(db(), userId))) return pro("mcp")(c);
    const b = await c.req.json().catch(() => ({}));
    const name = (typeof b.name === "string" ? b.name.trim() : "").slice(0, 80) || "MCP Token";
    const t = await repo.createMcpToken(db(), userId, name);
    return c.json(t);
  });

  authed.delete("/mcp-tokens/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return c.json({ error: "Invalid id" }, 400);
    const ok = await repo.deleteMcpToken(db(), c.get("user").id, id);
    return ok ? c.json({ success: true }) : c.json({ error: "Token not found" }, 404);
  });

  // shared dashboards (create = Pro) ----------------------------------------------------
  authed.get("/shares", async (c) => c.json({ shares: await repo.listShares(db(), c.get("user").id) }));

  authed.post("/shares", async (c) => {
    const userId = c.get("user").id;
    if (!(await repo.isPro(db(), userId))) return pro("sharing")(c);
    const b = await c.req.json().catch(() => ({}));
    const label = typeof b.label === "string" ? b.label.trim().slice(0, 120) || null : null;
    const filters = b.filters && typeof b.filters === "object" && JSON.stringify(b.filters).length < 4000 ? b.filters : {};
    let expires: string | null = null;
    if (typeof b.expires_at === "string" && b.expires_at) {
      const d = new Date(b.expires_at);
      if (Number.isNaN(d.getTime())) return c.json({ error: "Invalid expires_at" }, 400);
      expires = d.toISOString();
    }
    return c.json({ share: await repo.createShare(db(), userId, { label, filters, expires_at: expires }) });
  });

  authed.delete("/shares/:id", async (c) => {
    const id = c.req.param("id");
    if (!UUID_RE.test(id)) return c.json({ error: "Invalid id" }, 400);
    const ok = await repo.deleteShare(db(), c.get("user").id, id);
    return ok ? c.json({ success: true }) : c.json({ error: "Share not found" }, 404);
  });

  // billing ---------------------------------------------------------------------------
  authed.get("/subscription", async (c) => c.json(await subscriptionStatus(db(), c.get("user").id)));

  authed.post("/billing/checkout", async (c) => {
    const u = c.get("user");
    const r = await createCheckout(db(), { id: u.id, email: u.email }, await c.req.json().catch(() => ({})), c.req.header("origin") ?? null);
    return c.json(r.body as object, r.status as 200);
  });

  authed.post("/billing/portal", async (c) => {
    const r = await createPortal(db(), c.get("user").id, c.req.header("origin") ?? null);
    return c.json(r.body as object, r.status as 200);
  });

  // account deletion: end Stripe billing first, then delete the Neon Auth user (cascades) -----
  authed.post("/account/delete", async (c) => {
    const userId = c.get("user").id;
    const result = await deleteAccount(userId, {
      customerIdFor: async (id) => (await repo.getSubscription(db(), id))?.stripe_customer_id || null,
      billing: stripeBilling(),
      deleteRows: async (table, id) => {
        await db().query(`delete from public.${table} where user_id = $1`, [id]);
      },
      deleteAuthUser: (id) => repo.deleteUserCascade(db(), id),
      log: (msg, extra) => console.log(msg, JSON.stringify(extra ?? {})),
    });
    if ("error" in result) {
      const message = result.error === "delete_failed"
        ? "Smazání se nepovedlo, zkus to prosím znovu."
        : "Nepodařilo se ukončit předplatné Pro, účet zatím nemažeme. Zkus to prosím znovu, nebo napiš na podporu.";
      return c.json({ error: message, code: result.error }, result.error === "delete_failed" ? 500 : 502);
    }
    return c.json({ success: true, subscriptionCanceled: result.billing.canceled.length > 0 });
  });

  // AI (bring your own key) -----------------------------------------------------------
  // The user's own Anthropic key, stored encrypted. Only metadata (masked preview) is ever returned.
  authed.get("/ai-key", async (c) => c.json({ key: await repo.getAiKeyInfo(db(), c.get("user").id) }));

  authed.put("/ai-key", async (c) => {
    const userId = c.get("user").id;
    const b = await c.req.json().catch(() => ({}));
    const provider = String(b?.provider ?? "anthropic").toLowerCase();
    const apiKey = typeof b?.api_key === "string" ? b.api_key.trim() : "";
    const shapeError = validateAiKeyShape(provider, apiKey);
    if (shapeError) return c.json({ error: shapeError, code: "ai_key_shape" }, 400);
    const check = await verifyAnthropicKey(apiKey);
    if (check === "invalid") return c.json({ error: "Anthropic tento klíč odmítl. Zkontroluj, že je platný a aktivní.", code: "ai_key_invalid" }, 400);
    const key = await repo.saveAiKey(db(), userId, provider, apiKey);
    return c.json({ key, verified: check === "ok" });
  });

  authed.delete("/ai-key", async (c) => c.json({ deleted: await repo.deleteAiKey(db(), c.get("user").id) }));

  /** The caller's own key, or the AiResult to return when it is missing / unusable. */
  const userAiKey = async (userId: string) => {
    const key = await repo.aiKeyForUser(db(), userId);
    if (key === null) return { error: aiError("ai_key_missing") };
    if (key === "undecryptable") return { error: aiError("ai_key_invalid") };
    return { key };
  };

  authed.post("/chat-agent", async (c) => {
    const userId = c.get("user").id;
    if (!(await repo.isPro(db(), userId))) return pro("ai_agent")(c);
    const k = await userAiKey(userId);
    if (k.error) return c.json(k.error.body as object, k.error.status as 400);
    const r = await chatAgent(db(), userId, await c.req.json().catch(() => ({})), k.key);
    if (r.status === 200) await repo.markAiKeyUsed(db(), userId);
    return c.json(r.body as object, r.status as 200);
  });

  authed.post("/fun-ai", async (c) => {
    const userId = c.get("user").id;
    const b = await c.req.json().catch(() => ({}));
    if (!isFunMode(b?.mode)) return c.json({ error: "Invalid mode" }, 400);
    const k = await userAiKey(userId);
    if (k.error) return c.json(k.error.body as object, k.error.status as 400);
    const r = await funAi(b.mode, k.key);
    if (r.status === 200) await repo.markAiKeyUsed(db(), userId);
    return c.json(r.body as object, r.status as 200);
  });

  app.route("/", authed);
  app.notFound((c) => c.json({ error: "Not found" }, 404));
  return app;
}
