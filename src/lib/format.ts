import type { Currency } from "@/hooks/useCurrency";

const FALLBACK_RATE = 23.5;

const czFmt = new Intl.NumberFormat("cs-CZ");
const enFmt = new Intl.NumberFormat("en-US");
const czFmtDec = (d: number) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: d, maximumFractionDigits: d });
const enFmtDec = (d: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Format cost in given currency */
export function fmtCost(usd: number, decimals = 4, currency: Currency = "CZK", rate: number = FALLBACK_RATE): string {
  if (currency === "CZK") {
    return `${czFmtDec(decimals).format(usd * rate)} Kč`;
  }
  return `$${enFmtDec(decimals).format(usd)}`;
}

/** Format number with locale */
export function fmtNum(n: number, currency: Currency = "CZK"): string {
  return currency === "CZK" ? czFmt.format(n) : enFmt.format(n);
}

/** Format large numbers (K/M) */
export function fmtNumShort(n: number, currency: Currency = "CZK"): string {
  const fmt = currency === "CZK" ? czFmtDec : enFmtDec;
  if (n >= 1e6) return `${fmt(1).format(n / 1e6)}M`;
  if (n >= 1e3) return `${fmt(0).format(n / 1e3)}K`;
  return currency === "CZK" ? czFmt.format(n) : enFmt.format(n);
}

/** Shorten model name: strip date suffix, collapse common tokens, truncate */
export function shortModel(name: string, max = 22): string {
  if (!name) return name;
  let s = name.split("/").pop() || name;
  // strip ISO date suffix: -YYYY-MM-DD or -YYYYMMDD (with optional -preview after)
  s = s.replace(/-(20\d{2})-?(\d{2})-?(\d{2})(?=(-|$))/g, "");
  // collapse common verbose tokens
  s = s
    .replace(/-preview\b/gi, "-prev")
    .replace(/-experimental\b/gi, "-exp")
    .replace(/-instruct\b/gi, "-ins")
    .replace(/-thinking\b/gi, "-think");
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/** Format cost for chart axis (short) */
export function fmtCostShort(usd: number, currency: Currency = "CZK", rate: number = FALLBACK_RATE): string {
  if (currency === "CZK") {
    const czk = usd * rate;
    return czk >= 1 ? `${czFmtDec(0).format(czk)} Kč` : `${czFmtDec(2).format(czk)} Kč`;
  }
  return usd >= 1 ? `$${enFmtDec(0).format(usd)}` : `$${enFmtDec(2).format(usd)}`;
}
