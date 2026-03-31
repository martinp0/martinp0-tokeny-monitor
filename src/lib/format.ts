// USD to CZK conversion rate
const USD_TO_CZK = 23.5;

const czFmt = new Intl.NumberFormat("cs-CZ");
const czFmtDec = (decimals: number) => new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Format USD cost as CZK */
export function fmtCost(usd: number, decimals = 4): string {
  const czk = usd * USD_TO_CZK;
  return `${czFmtDec(decimals).format(czk)} Kč`;
}

/** Format number with Czech locale */
export function fmtNum(n: number): string {
  return czFmt.format(n);
}

/** Format large numbers (K/M) with Czech locale */
export function fmtNumShort(n: number): string {
  if (n >= 1e6) return `${czFmtDec(1).format(n / 1e6)}M`;
  if (n >= 1e3) return `${czFmtDec(0).format(n / 1e3)}K`;
  return czFmt.format(n);
}

/** Format cost for chart axis (short) */
export function fmtCostShort(usd: number): string {
  const czk = usd * USD_TO_CZK;
  if (czk >= 1) return `${czFmtDec(0).format(czk)} Kč`;
  return `${czFmtDec(2).format(czk)} Kč`;
}

/** Raw USD→CZK conversion */
export function usdToCzk(usd: number): number {
  return usd * USD_TO_CZK;
}
