import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseCSV, type ActivityRow } from "@/lib/csv-parser";
import sampleCSV from "@/data/sample.csv?raw";

export function useDashboardData(options: { demoMode?: boolean } = {}) {
  const { demoMode = false } = options;
  const { session } = useAuth();
  const [data, setData] = useState<ActivityRow[]>([]);
  const [fileName, setFileName] = useState<string>("Loading...");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<{ from: Date; to: Date } | null>(null);
  const [hasUserData, setHasUserData] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Load data from DB, fall back to sample CSV
  useEffect(() => {
    async function loadFromDB() {
      // Demo mode: load only sample CSV, skip DB calls (works without auth)
      if (demoMode) {
        const parsed = parseCSV(sampleCSV);
        setData(parsed);
        setFileName("demo data – openrouter sample");
        setHasUserData(true);
        setLoading(false);
        return;
      }

      const { data: rows, error } = await supabase
        .from("activity_rows")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && rows && rows.length > 0) {
        const mapped: ActivityRow[] = rows.map((r) => ({
          generation_id: r.generation_id,
          created_at: r.created_at,
          cost_total: r.cost_total,
          cost_web_search: r.cost_web_search,
          cost_cache: r.cost_cache,
          cost_file_processing: r.cost_file_processing,
          byok_usage_inference: r.byok_usage_inference,
          tokens_prompt: r.tokens_prompt,
          tokens_completion: r.tokens_completion,
          tokens_reasoning: r.tokens_reasoning,
          tokens_cached: r.tokens_cached,
          model_permaslug: r.model_permaslug,
          provider_name: r.provider_name,
          variant: r.variant,
          cancelled: r.cancelled,
          streamed: r.streamed,
          user: r.user,
          finish_reason_raw: r.finish_reason_raw,
          finish_reason_normalized: r.finish_reason_normalized,
          generation_time_ms: r.generation_time_ms,
          time_to_first_token_ms: r.time_to_first_token_ms,
          app_name: r.app_name,
          api_key_name: r.api_key_name,
        }));
        setData(mapped);
        setFileName(`Cloud DB (${mapped.length} rows)`);
        setHasUserData(true);
      } else {
        // No user data — leave empty so onboarding can render
        setData([]);
        setFileName("Žádná data – nahrajte první CSV");
        setHasUserData(false);
      }
      setLoading(false);
    }
    loadFromDB();
  }, [demoMode]);

  // Upload CSV → save to DB
  const loadCSV = useCallback(async (text: string, name: string) => {
    const parsed = parseCSV(text);
    setData(parsed);
    setFileName(name);
    setSelectedModel(null);

    // Upsert to DB in batches
    const batchSize = 100;
    for (let i = 0; i < parsed.length; i += batchSize) {
      const batch = parsed.slice(i, i + batchSize).map((r) => ({
        generation_id: r.generation_id,
        created_at: r.created_at,
        cost_total: r.cost_total,
        cost_web_search: r.cost_web_search,
        cost_cache: r.cost_cache,
        cost_file_processing: r.cost_file_processing,
        byok_usage_inference: r.byok_usage_inference,
        tokens_prompt: r.tokens_prompt,
        tokens_completion: r.tokens_completion,
        tokens_reasoning: r.tokens_reasoning,
        tokens_cached: r.tokens_cached,
        model_permaslug: r.model_permaslug,
        provider_name: r.provider_name,
        variant: r.variant,
        cancelled: r.cancelled,
        streamed: r.streamed,
        user: r.user,
        finish_reason_raw: r.finish_reason_raw,
        finish_reason_normalized: r.finish_reason_normalized,
        generation_time_ms: r.generation_time_ms,
        time_to_first_token_ms: r.time_to_first_token_ms,
        app_name: r.app_name,
        api_key_name: r.api_key_name,
        user_id: session?.user?.id,
      }));
      await supabase.from("activity_rows").upsert(batch, { onConflict: "generation_id" });
    }
    setHasUserData(parsed.length > 0);
  }, [session]);

  // Sync from OpenRouter API via edge function
  const syncFromAPI = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const { data: result, error } = await supabase.functions.invoke("sync-openrouter");
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      // Reload from DB after sync
      const { data: rows } = await supabase
        .from("activity_rows")
        .select("*")
        .order("created_at", { ascending: false });

      if (rows && rows.length > 0) {
        const mapped: ActivityRow[] = rows.map((r) => ({
          generation_id: r.generation_id,
          created_at: r.created_at,
          cost_total: r.cost_total,
          cost_web_search: r.cost_web_search,
          cost_cache: r.cost_cache,
          cost_file_processing: r.cost_file_processing,
          byok_usage_inference: r.byok_usage_inference,
          tokens_prompt: r.tokens_prompt,
          tokens_completion: r.tokens_completion,
          tokens_reasoning: r.tokens_reasoning,
          tokens_cached: r.tokens_cached,
          model_permaslug: r.model_permaslug,
          provider_name: r.provider_name,
          variant: r.variant,
          cancelled: r.cancelled,
          streamed: r.streamed,
          user: r.user,
          finish_reason_raw: r.finish_reason_raw,
          finish_reason_normalized: r.finish_reason_normalized,
          generation_time_ms: r.generation_time_ms,
          time_to_first_token_ms: r.time_to_first_token_ms,
          app_name: r.app_name,
          api_key_name: r.api_key_name,
        }));
        setData(mapped);
        setFileName(`Cloud DB (${mapped.length} rows) — synced`);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Apply date filter first, then model filter
  const dateFiltered = dateFilter
    ? data.filter((r) => {
        const d = r.created_at.substring(0, 10);
        const from = dateFilter.from.toISOString().substring(0, 10);
        const to = dateFilter.to.toISOString().substring(0, 10);
        return d >= from && d <= to;
      })
    : data;

  const filteredData = selectedModel
    ? dateFiltered.filter((r) => r.model_permaslug === selectedModel)
    : dateFiltered;

  const models = [...new Set(dateFiltered.map((r) => r.model_permaslug))];
  const providers = [...new Set(dateFiltered.map((r) => r.provider_name))];

  const totalCost = dateFiltered.reduce((s, r) => s + r.cost_total, 0);
  const totalRequests = dateFiltered.length;
  const totalTokens = dateFiltered.reduce(
    (s, r) => s + r.tokens_prompt + r.tokens_completion + r.tokens_reasoning,
    0
  );
  const avgGenTime =
    dateFiltered.length > 0
      ? dateFiltered.reduce((s, r) => s + r.generation_time_ms, 0) / dateFiltered.length
      : 0;

  const dateRange = data.length > 0
    ? {
        from: data.reduce((min, r) => (r.created_at < min ? r.created_at : min), data[0].created_at),
        to: data.reduce((max, r) => (r.created_at > max ? r.created_at : max), data[0].created_at),
      }
    : null;

  const costByModel = models.map((m) => ({
    model: m.split("/").pop() || m,
    fullModel: m,
    cost: dateFiltered.filter((r) => r.model_permaslug === m).reduce((s, r) => s + r.cost_total, 0),
  })).sort((a, b) => b.cost - a.cost);

  const costByProvider = providers.map((p) => ({
    provider: p,
    cost: dateFiltered.filter((r) => r.provider_name === p).reduce((s, r) => s + r.cost_total, 0),
    requests: dateFiltered.filter((r) => r.provider_name === p).length,
  })).sort((a, b) => b.cost - a.cost);

  const timeSeries = [...filteredData]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => ({
      time: r.created_at.substring(11, 16),
      fullTime: r.created_at,
      cost: r.cost_total,
      tokens_prompt: r.tokens_prompt,
      tokens_completion: r.tokens_completion,
      tokens_reasoning: r.tokens_reasoning,
      tokens_cached: r.tokens_cached,
      generation_time_ms: r.generation_time_ms,
      time_to_first_token_ms: r.time_to_first_token_ms,
      model: r.model_permaslug.split("/").pop() || r.model_permaslug,
    }));

  return {
    data,
    filteredData,
    fileName,
    selectedModel,
    setSelectedModel,
    dateFilter,
    setDateFilter,
    loadCSV,
    syncFromAPI,
    syncing,
    syncError,
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
  };
}
