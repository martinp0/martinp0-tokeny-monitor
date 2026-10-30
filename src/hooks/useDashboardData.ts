import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseCSV, type ActivityRow, type BillingType, type ProviderSource } from "@/lib/csv-parser";
import { fetchAllPages } from "@/lib/paginate";
import {
  computeTotals,
  costByModel as aggCostByModel,
  costByProvider as aggCostByProvider,
  dateRangeOf,
  filterByDate,
  timeSeries as aggTimeSeries,
} from "@/lib/aggregations";
import sampleCSV from "@/data/sample.csv?raw";
import { useSubscription } from "@/hooks/useSubscription";
import { FREE_LIMITS, splitRowsForPlan } from "@/lib/plan";
import { isUsageExportHeader, streamUsageExport, usageBreakdown } from "@/lib/usage-export";

/** Upper bound of rows loaded into the browser. Beyond this the dashboard says it is truncated. */
const MAX_DASHBOARD_ROWS = 100_000;
const UPSERT_BATCH = 500;

type DbRow = Record<string, unknown> & { provider_source?: string | null; request_count?: number | null };

function mapDbRow(r: DbRow): ActivityRow {
  return {
    generation_id: r.generation_id as string,
    created_at: r.created_at as string,
    cost_total: r.cost_total as number,
    cost_web_search: r.cost_web_search as number,
    cost_cache: r.cost_cache as number,
    cost_file_processing: r.cost_file_processing as number,
    byok_usage_inference: r.byok_usage_inference as number,
    tokens_prompt: r.tokens_prompt as number,
    tokens_completion: r.tokens_completion as number,
    tokens_reasoning: r.tokens_reasoning as number,
    tokens_cached: r.tokens_cached as number,
    model_permaslug: r.model_permaslug as string,
    provider_name: r.provider_name as string,
    variant: r.variant as string,
    cancelled: r.cancelled as boolean,
    streamed: r.streamed as boolean,
    user: r.user as string,
    finish_reason_raw: r.finish_reason_raw as string,
    finish_reason_normalized: r.finish_reason_normalized as string,
    generation_time_ms: r.generation_time_ms as number,
    time_to_first_token_ms: r.time_to_first_token_ms as number,
    app_name: r.app_name as string,
    api_key_name: r.api_key_name as string,
    provider_source: (r.provider_source ?? "openrouter") as ProviderSource,
    request_count: r.request_count ?? 1,
    tokens_cache_write: (r.tokens_cache_write as number | null) ?? 0,
    billing_type: (r.billing_type as BillingType | null) ?? null,
  };
}

export interface CsvImportResult {
  parsed: number;
  saved: number;
  failed: number;
  error?: string;
  /** Usage exports only: rows that were already stored (same Billing Item ID) and were left as is. */
  alreadyImported?: number;
}

/** Import progress callback, 0..1. */
export type ImportProgress = (fraction: number) => void;

export function useDashboardData(options: { demoMode?: boolean } = {}) {
  const { demoMode = false } = options;
  const { session } = useAuth();
  const { isPro, loading: planLoading } = useSubscription();
  const [data, setData] = useState<ActivityRow[]>([]);
  const [fileName, setFileName] = useState<string>("Loading...");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<{ from: Date; to: Date } | null>(null);
  const [hasUserData, setHasUserData] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Load ALL of the user's rows (paged; PostgREST returns at most 1000 rows per request).
  useEffect(() => {
    let cancelled = false;
    async function loadFromDB() {
      // Demo mode: load only sample CSV, skip DB calls (works without auth)
      if (demoMode) {
        setData(parseCSV(sampleCSV));
        setFileName("demo data – openrouter sample");
        setHasUserData(true);
        setLoading(false);
        return;
      }

      try {
        const { rows, truncated } = await fetchAllPages<DbRow>(
          (from, to) =>
            supabase
              .from("activity_rows")
              .select("*")
              .order("created_at", { ascending: false })
              .order("id", { ascending: true })
              .range(from, to) as unknown as PromiseLike<{ data: DbRow[] | null; error: { message: string } | null }>,
          { maxRows: MAX_DASHBOARD_ROWS },
        );
        if (cancelled) return;
        setTruncated(truncated);
        if (rows.length > 0) {
          const mapped = rows.map(mapDbRow);
          setData(mapped);
          setFileName(`Cloud DB (${mapped.length.toLocaleString()} rows${truncated ? ", truncated" : ""})`);
          setHasUserData(true);
        } else {
          // No user data — leave empty so onboarding can render
          setData([]);
          setFileName("Žádná data – nahrajte první CSV");
          setHasUserData(false);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setLoadError(msg);
        setData([]);
        setFileName("Chyba načítání dat");
        setHasUserData(false);
        toast.error(`Nepodařilo se načíst data: ${msg}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFromDB();
    return () => {
      cancelled = true;
    };
  }, [demoMode, reloadKey]);

  // Upload CSV → save to DB. Errors are surfaced (toast + return value), never swallowed.
  const loadCSV = useCallback(async (text: string, name: string): Promise<CsvImportResult> => {
    if (session?.user?.id && planLoading) {
      toast.info("Načítám tvůj tarif – zkus import za okamžik znovu.");
      return { parsed: 0, saved: 0, failed: 0, error: "plan_loading" };
    }
    const parsed = parseCSV(text);
    // Signed-in free users see (and store) the free window only, same as after a reload.
    const { keep: toSave, skipped } = session?.user?.id ? splitRowsForPlan(parsed, isPro) : { keep: parsed, skipped: 0 };
    setData(toSave);
    setFileName(name);
    setSelectedModel(null);
    setHasUserData(parsed.length > 0);

    if (parsed.length === 0) {
      toast.error("CSV neobsahuje žádné platné řádky (chybí generation_id / created_at).");
      return { parsed: 0, saved: 0, failed: 0, error: "empty" };
    }
    const userId = session?.user?.id;
    if (!userId) {
      toast.error("Nejsi přihlášen – data nebyla uložena.");
      return { parsed: parsed.length, saved: 0, failed: parsed.length, error: "not_authenticated" };
    }

    // Free plan keeps the last 30 days (RLS rejects older rows for free users anyway).
    if (skipped > 0) {
      toast.info(
        `${skipped.toLocaleString()} řádků starších než ${FREE_LIMITS.historyDays} dní se ve Free neukládá. S Pro importuješ celou historii.`,
      );
    }

    let saved = 0;
    let failed = 0;
    let firstError: string | undefined;
    for (let i = 0; i < toSave.length; i += UPSERT_BATCH) {
      const batch = toSave.slice(i, i + UPSERT_BATCH).map((r) => ({ ...r, user_id: userId }));
      const { error } = await supabase
        .from("activity_rows")
        .upsert(batch, { onConflict: "user_id,generation_id" });
      if (error) {
        failed += batch.length;
        firstError ??= error.message;
      } else {
        saved += batch.length;
      }
    }

    if (failed > 0) {
      toast.error(`Uložení ${failed.toLocaleString()} z ${toSave.length.toLocaleString()} řádků selhalo: ${firstError}`);
    } else if (toSave.length > 0) {
      toast.success(`Uloženo ${saved.toLocaleString()} řádků.`);
    }
    return { parsed: parsed.length, saved, failed, error: firstError };
  }, [session, isPro, planLoading]);

  /**
   * Cursor / Grok Bot usage export: parsed in the browser in streaming chunks (the export can be
   * tens of MB), written in batches as the user (RLS: user_id = auth.uid()), deduplicated on
   * (user_id, Billing Item ID) so re-importing the same or an overlapping export adds nothing twice.
   */
  const importUsageExport = useCallback(async (file: File, onProgress?: ImportProgress): Promise<CsvImportResult> => {
    const userId = session?.user?.id;
    if (!userId) {
      toast.error("Nejsi přihlášen – data nebyla uložena.");
      return { parsed: 0, saved: 0, failed: 0, error: "not_authenticated" };
    }
    if (planLoading) {
      toast.info("Načítám tvůj tarif – zkus import za okamžik znovu.");
      return { parsed: 0, saved: 0, failed: 0, error: "plan_loading" };
    }
    let saved = 0;
    let alreadyImported = 0;
    let failed = 0;
    let tooOld = 0;
    let firstError: string | undefined;
    try {
      const stats = await streamUsageExport(file, {
        batchSize: UPSERT_BATCH,
        onProgress,
        onBatch: async (rows) => {
          const { keep, skipped } = splitRowsForPlan(rows, isPro);
          tooOld += skipped;
          if (keep.length === 0) return;
          const { data: inserted, error } = await supabase
            .from("activity_rows")
            .upsert(keep.map((r) => ({ ...r, user_id: userId })), {
              onConflict: "user_id,generation_id",
              ignoreDuplicates: true,
            })
            .select("generation_id");
          if (error) {
            failed += keep.length;
            firstError ??= error.message;
            return;
          }
          const n = inserted?.length ?? 0;
          saved += n;
          alreadyImported += keep.length - n;
        },
      });
      const skippedRows = Object.values(stats.skipped).reduce((a, b) => a + b, 0);
      if (tooOld > 0) {
        toast.info(
          `${tooOld.toLocaleString()} řádků starších než ${FREE_LIMITS.historyDays} dní se ve Free neukládá. S Pro importuješ celou historii.`,
        );
      }
      if (skippedRows > 0 || stats.duplicatesInFile > 0) {
        toast.info(
          `Přeskočeno ${skippedRows.toLocaleString()} neplatných řádků a ${stats.duplicatesInFile.toLocaleString()} duplicit v souboru.`,
        );
      }
      if (failed > 0) {
        toast.error(`Uložení ${failed.toLocaleString()} řádků selhalo: ${firstError}`);
      } else {
        toast.success(
          `Import Cursor / Grok Bot: ${saved.toLocaleString()} nových řádků` +
            (alreadyImported > 0 ? `, ${alreadyImported.toLocaleString()} už bylo uloženo.` : "."),
        );
      }
      if (saved > 0) {
        setSelectedModel(null);
        setReloadKey((k) => k + 1);
      }
      return { parsed: stats.mapped, saved, failed, alreadyImported, error: firstError };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Import selhal: ${msg}`);
      if (saved > 0) setReloadKey((k) => k + 1);
      return { parsed: 0, saved, failed, alreadyImported, error: msg };
    }
  }, [session, isPro, planLoading]);

  /** Entry point for the upload UI: picks the importer from the CSV header. */
  const importFile = useCallback(async (file: File, onProgress?: ImportProgress): Promise<CsvImportResult> => {
    const head = await file.slice(0, 4096).text();
    if (isUsageExportHeader(head)) return importUsageExport(file, onProgress);
    const text = await file.text();
    onProgress?.(0.5);
    const result = await loadCSV(text, file.name);
    onProgress?.(1);
    return result;
  }, [importUsageExport, loadCSV]);

  // Apply date filter first, then model filter
  const dateFiltered = useMemo(() => filterByDate(data, dateFilter), [data, dateFilter]);
  const filteredData = useMemo(
    () => (selectedModel ? dateFiltered.filter((r) => r.model_permaslug === selectedModel) : dateFiltered),
    [dateFiltered, selectedModel],
  );

  const models = useMemo(() => [...new Set(dateFiltered.map((r) => r.model_permaslug))], [dateFiltered]);
  const providers = useMemo(() => [...new Set(dateFiltered.map((r) => r.provider_name))], [dateFiltered]);
  const { totalCost, totalRequests, totalTokens, avgGenTime } = useMemo(() => computeTotals(dateFiltered), [dateFiltered]);
  const dateRange = useMemo(() => dateRangeOf(data), [data]);
  const costByModel = useMemo(() => aggCostByModel(dateFiltered), [dateFiltered]);
  const costByProvider = useMemo(() => aggCostByProvider(dateFiltered), [dateFiltered]);
  const timeSeries = useMemo(() => aggTimeSeries(filteredData), [filteredData]);
  const usageSplit = useMemo(() => usageBreakdown(filteredData), [filteredData]);

  return {
    data,
    filteredData,
    fileName,
    selectedModel,
    setSelectedModel,
    dateFilter,
    setDateFilter,
    loadCSV,
    importFile,
    usageBreakdown: usageSplit,
    models,
    providers,
    totalCost,
    totalRequests,
    totalTokens,
    avgGenTime,
    dateRange,
    costByModel,
    costByProvider,
    timeSeries,
    hasUserData,
    loading,
    loadError,
    truncated,
  };
}
