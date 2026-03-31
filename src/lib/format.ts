import type { Currency } from "@/hooks/useCurrency";

const USD_TO_CZK = 23.5;

const czFmt = new Intl.NumberFormat("cs-CZ");
const enFmt = new Intl.NumberFormat("en-US");
const czFmtDec = (d: number) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: d, maximumFractionDigits: d });
const enFmtDec = (d: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Format cost in given currency */
export function fmtCost(usd: number, decimals = 4, currency: Currency = "CZK"): string {
  if (currency === "CZK") {
    return `${czFmtDec(decimals).format(usd * USD_TO_CZK)} Kč`;
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

/** Format cost for chart axis (short) */
export function fmtCostShort(usd: number, currency: Currency = "CZK"): string {
  if (currency === "CZK") {
    const czk = usd * USD_TO_CZK;
    return czk >= 1 ? `${czFmtDec(0).format(czk)} Kč` : `${czFmtDec(2).format(czk)} Kč`;
  }
  return usd >= 1 ? `$${enFmtDec(0).format(usd)}` : `$${enFmtDec(2).format(usd)}`;
}
