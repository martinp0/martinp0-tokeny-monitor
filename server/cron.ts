// Daily maintenance (Vercel Hobby allows one cron run per day): ČNB rate, Pro auto-sync, budget check.
import type { Db } from "./db.js";
import { runCredentialSync } from "./lib/sync-runner.js";
import {
  budgetAlertsForCron, decryptCredential, dueCredentialsForCron, getExchangeRate, insertBudgetEvents, markBudgetNotified,
  markCredentialSync, saveExchangeRate, pruneRateLimits } from "./repo.js";
import { alertsFor, budgetStatus, FALLBACK_USD_CZK } from "./budget-status.js";

const CNB_URL = "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";

export function parseCnb(text: string): { rate: number; date: string | null } | null {
  const lines = text.split("\n");
  const date = lines[0]?.trim().split(" ")[0] || null;
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length >= 5 && parts[3]?.trim() === "USD") {
      const amount = parseInt(parts[2]?.trim() || "1", 10) || 1;
      const value = parseFloat(parts[4]?.trim().replace(",", ".") || "0");
      if (value > 0) return { rate: value / amount, date };
    }
  }
  return null;
}

export async function refreshExchangeRate(db: Db): Promise<{ rate: number; date: string | null } | null> {
  const res = await fetch(CNB_URL);
  if (!res.ok) throw new Error(`CNB returned ${res.status}`);
  const parsed = parseCnb(await res.text());
  if (parsed) await saveExchangeRate(db, parsed.rate, parsed.date);
  return parsed;
}

const DAY = 86_400_000;

export async function autoSync(db: Db, budgetMs = 200_000, max = 50) {
  const started = Date.now();
  const due = await dueCredentialsForCron(db, new Date(Date.now() - 55 * 60_000), max);
  const results: Array<{ id: string; ok: boolean; inserted?: number; error?: string }> = [];
  for (const c of due) {
    if (Date.now() - started > budgetMs) break;
    let apiKey: string;
    try {
      apiKey = decryptCredential(c);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markCredentialSync(db, c.id, c.user_id, { status: "error", error: msg });
      results.push({ id: c.id, ok: false, error: "key" });
      continue;
    }
    const end = new Date();
    const start = new Date(end.getTime() - (c.last_synced_at ? 3 : 30) * DAY);
    const out = await runCredentialSync(db, { id: c.id, user_id: c.user_id, provider: c.provider, enabled: c.enabled, last_synced_at: c.last_synced_at, api_key: apiKey }, { start, end });
    results.push({ id: c.id, ok: out.ok, inserted: out.inserted });
  }
  return { due: due.length, processed: results.length, ok: results.filter((r) => r.ok).length };
}

/**
 * In-app budget alerts for Pro users: thresholds (e.g. 50/80/100 % of the budget, total and per
 * provider) and "forecast exceeds budget". Deduped per month by budget_events' unique key, so the
 * cron is safe to rerun. No e-mail is sent (there is no e-mail service).
 */
export async function checkBudgets(db: Db, now = new Date(), onlyUserId: string | null = null) {
  let flagged = 0;
  const rate = (await getExchangeRate(db))?.rate ?? FALLBACK_USD_CZK;
  const budgets = await budgetAlertsForCron(db, onlyUserId);
  for (const b of budgets) {
    const status = await budgetStatus(db, b.user_id, b, now, rate);
    const inserted = await insertBudgetEvents(db, b.user_id, status.period, alertsFor(b, status));
    if (inserted > 0) {
      await markBudgetNotified(db, b.user_id);
      flagged += inserted;
    }
  }
  return { alerts: budgets.length, flagged };
}

export async function runDaily(db: Db) {
  const out: Record<string, unknown> = {};
  try { out.exchange_rate = await refreshExchangeRate(db); } catch (e) { out.exchange_rate_error = e instanceof Error ? e.message : String(e); }
  try { out.sync = await autoSync(db); } catch (e) { out.sync_error = e instanceof Error ? e.message : String(e); }
  try { out.budget = await checkBudgets(db); } catch (e) { out.budget_error = e instanceof Error ? e.message : String(e); }
  try { out.rate_limits_pruned = await pruneRateLimits(db); } catch (e) { out.rate_limits_error = e instanceof Error ? e.message : String(e); }
  return out;
}
