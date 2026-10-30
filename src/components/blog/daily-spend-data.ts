/**
 * Over-plan (on-demand) spend per day, Oct 1–30 2026, Grok Bot + Cursor, in USD.
 * Aggregated from Martin's own usage export (days in Europe/Prague, rounded to cents).
 * Only these daily totals are published, never individual rows.
 */
export const DAILY_USD: { day: number; grokBot: number; cursor: number }[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ day: i + 1, grokBot: 0, cursor: 0 })),
  { day: 21, grokBot: 0, cursor: 20.51 },
  { day: 22, grokBot: 93.78, cursor: 163.96 },
  { day: 23, grokBot: 84.14, cursor: 94.96 },
  { day: 24, grokBot: 2.99, cursor: 0.03 },
  { day: 25, grokBot: 0, cursor: 0 },
  { day: 26, grokBot: 19.13, cursor: 0 },
  { day: 27, grokBot: 28.15, cursor: 0 },
  { day: 28, grokBot: 154.03, cursor: 28.85 },
  { day: 29, grokBot: 99.89, cursor: 68.88 },
  { day: 30, grokBot: 0, cursor: 0.01 },
];
