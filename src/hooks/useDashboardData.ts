import { useState, useCallback } from "react";
import { parseCSV, type ActivityRow } from "@/lib/csv-parser";
import sampleCSV from "@/data/sample.csv?raw";

export function useDashboardData() {
  const [data, setData] = useState<ActivityRow[]>(() => parseCSV(sampleCSV));
  const [fileName, setFileName] = useState<string>("openrouter_activity_2026-03-28.csv");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const loadCSV = useCallback((text: string, name: string) => {
    const parsed = parseCSV(text);
    setData(parsed);
    setFileName(name);
    setSelectedModel(null);
  }, []);

  const filteredData = selectedModel
    ? data.filter((r) => r.model_permaslug === selectedModel)
    : data;

  const models = [...new Set(data.map((r) => r.model_permaslug))];
  const providers = [...new Set(data.map((r) => r.provider_name))];

  const totalCost = data.reduce((s, r) => s + r.cost_total, 0);
  const totalRequests = data.length;
  const totalTokens = data.reduce(
    (s, r) => s + r.tokens_prompt + r.tokens_completion + r.tokens_reasoning,
    0
  );
  const avgGenTime =
    data.length > 0
      ? data.reduce((s, r) => s + r.generation_time_ms, 0) / data.length
      : 0;

  const dateRange = data.length > 0
    ? {
        from: data.reduce((min, r) => (r.created_at < min ? r.created_at : min), data[0].created_at),
        to: data.reduce((max, r) => (r.created_at > max ? r.created_at : max), data[0].created_at),
      }
    : null;

  // Cost per model
  const costByModel = models.map((m) => ({
    model: m.split("/").pop() || m,
    fullModel: m,
    cost: data.filter((r) => r.model_permaslug === m).reduce((s, r) => s + r.cost_total, 0),
  })).sort((a, b) => b.cost - a.cost);

  // Cost per provider
  const costByProvider = providers.map((p) => ({
    provider: p,
    cost: data.filter((r) => r.provider_name === p).reduce((s, r) => s + r.cost_total, 0),
    requests: data.filter((r) => r.provider_name === p).length,
  })).sort((a, b) => b.cost - a.cost);

  // Time series data (sorted by time)
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
    loadCSV,
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
  };
}
