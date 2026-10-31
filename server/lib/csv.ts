/**
 * CSV writer with formula-injection protection (OWASP "CSV injection"): a text cell that starts
 * with = + - @ TAB or CR is prefixed with an apostrophe so spreadsheet apps show it as text instead
 * of evaluating it. Numbers are written as plain numbers (dot decimals). PURE.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** UTF-8 BOM + header + rows, CRLF line ends (what Excel expects). */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
