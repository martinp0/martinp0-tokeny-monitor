// Reads *all* rows of a paged API (GET /api/activity?offset&limit) page by page, so a large
// history is never silently truncated by a per-request cap.

export const POSTGREST_MAX_ROWS = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface FetchAllResult<T> {
  rows: T[];
  /** true when maxRows was hit and more rows may exist */
  truncated: boolean;
}

/**
 * Calls `fetchPage(from, to)` (inclusive range, like PostgREST `.range(from, to)`) until a short
 * page is returned or `maxRows` is reached. The query passed in MUST have a deterministic
 * order (e.g. `.order("created_at").order("id")`), otherwise pages can overlap/skip.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  { pageSize = POSTGREST_MAX_ROWS, maxRows = 100_000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<FetchAllResult<T>> {
  if (pageSize <= 0) throw new Error("pageSize must be > 0");
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < to - from + 1) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}
