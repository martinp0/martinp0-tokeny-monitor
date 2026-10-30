import { describe, it, expect, vi } from "vitest";
import { fetchAllPages } from "@/lib/paginate";

const source = Array.from({ length: 2345 }, (_, i) => i);
const pager = (data: number[], max = 1000) =>
  vi.fn(async (from: number, to: number) => ({ data: data.slice(from, Math.min(to + 1, from + max)), error: null }));

describe("fetchAllPages", () => {
  it("reads past the 1000-row PostgREST cap", async () => {
    const fetchPage = pager(source);
    const { rows, truncated } = await fetchAllPages(fetchPage);
    expect(rows).toEqual(source);
    expect(truncated).toBe(false);
    expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("stops after an exactly-full last page with one extra empty request", async () => {
    const fetchPage = pager(source.slice(0, 2000));
    const { rows } = await fetchAllPages(fetchPage);
    expect(rows).toHaveLength(2000);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("flags truncation at maxRows", async () => {
    const fetchPage = pager(source);
    const { rows, truncated } = await fetchAllPages(fetchPage, { maxRows: 1500 });
    expect(rows).toHaveLength(1500);
    expect(truncated).toBe(true);
    expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1499]]);
  });

  it("throws on errors instead of returning partial data", async () => {
    const fetchPage = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    await expect(fetchAllPages(fetchPage)).rejects.toThrow("boom");
  });
});
