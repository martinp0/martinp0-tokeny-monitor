// Daily maintenance (Vercel Hobby allows one cron run per day): ČNB rate, Pro auto-sync, budget check.
import type { Db } from "./db.js";
import { runCredentialSync } from "./lib/sync-runner.js";
import {
  aggregateActivity, budgetAlertsForCron, decryptCredential, dueCredentialsForCron, markBudgetNotified,
  markCredentialSync, saveExchangeRate,
} from "./repo.js";

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

/** Same rule as the former check-budget: mark once per month when spend crosses the threshold (no e-mail is sent). */
export async function checkBudgets(db: Db, now = new Date()) {
  const monthStart = `${now.toISOString().slice(0, 7)}-01`;
  let flagged = 0;
  const alerts = await budgetAlertsForCron(db);
  for (const a of alerts) {
    const [agg] = await aggregateActivity(db, a.user_id, { groupBy: "none", from: monthStart });
    const spent = Number(agg?.cost_total ?? 0);
    const pct = a.monthly_budget_usd > 0 ? (spent / a.monthly_budget_usd) * 100 : 0;
    const notifiedThisMonth = a.last_notified_at && new Date(a.last_notified_at).toISOString().slice(0, 7) === now.toISOString().slice(0, 7);
    if (pct >= a.threshold_pct && !notifiedThisMonth) {
      await markBudgetNotified(db, a.user_id);
      flagged++;
    }
  }
  return { alerts: alerts.length, flagged };
}

export async function runDaily(db: Db) {
  const out: Record<string, unknown> = {};
  try { out.exchange_rate = await refreshExchangeRate(db); } catch (e) { out.exchange_rate_error = e instanceof Error ? e.message : String(e); }
  try { out.sync = await autoSync(db); } catch (e) { out.sync_error = e instanceof Error ? e.message : String(e); }
  try { out.budget = await checkBudgets(db); } catch (e) { out.budget_error = e instanceof Error ? e.message : String(e); }
  return out;
}
