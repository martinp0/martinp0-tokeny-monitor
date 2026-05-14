import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CostTimeChart } from "@/components/dashboard/CostTimeChart";
import { TokensChart } from "@/components/dashboard/TokensChart";
import { ModelCostChart } from "@/components/dashboard/ModelCostChart";
import { ProviderChart } from "@/components/dashboard/ProviderChart";
import { SpeedChart } from "@/components/dashboard/SpeedChart";
import { RequestsTable } from "@/components/dashboard/RequestsTable";
import { Activity, ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/hooks/useCurrency";

interface SharedData {
  label: string;
  owner: string;
  created_at: string;
  rows: any[];
  filters: any;
}

export default function SharedDashboard() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { currency, toggle: toggleCurrency, exchangeRate } = useCurrency();

  useEffect(() => {
    if (!token) return;

    // Inject OG meta tags pointing to the dynamic preview endpoint
    const ogImage = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-dashboard?token=${token}`;
    const pageUrl = `${window.location.origin}/shared/${token}`;
    const tags: Array<[string, string, string]> = [
      ["property", "og:image", ogImage],
      ["property", "og:image:width", "1200"],
      ["property", "og:image:height", "630"],
      ["property", "og:type", "website"],
      ["property", "og:url", pageUrl],
      ["property", "og:title", "Sdílený dashboard – OpenRouter Monitor"],
      ["name", "twitter:card", "summary_large_image"],
      ["name", "twitter:image", ogImage],
    ];
    const created: HTMLMetaElement[] = [];
    tags.forEach(([attr, key, value]) => {
      const sel = `meta[${attr}="${key}"]`;
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute("content", value);
    });

    // Use fetch directly since we need query params
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-shared-dashboard?token=${token}`;
    fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    return () => {
      created.forEach((el) => el.remove());
    };
  }, [token]);

  const processed = useMemo(() => {
    if (!data?.rows?.length) return null;

    const rows = data.rows;
    const rate = currency === "CZK" ? exchangeRate : 1;

    const totalCost = rows.reduce((s: number, r: any) => s + (r.cost_total || 0), 0) * rate;
    const totalRequests = rows.length;
    const totalTokens = rows.reduce((s: number, r: any) => s + (r.tokens_prompt || 0) + (r.tokens_completion || 0), 0);
    const avgGenTime = rows.reduce((s: number, r: any) => s + (r.generation_time_ms || 0), 0) / rows.length;

    // Cost by model
    const modelMap: Record<string, number> = {};
    rows.forEach((r: any) => {
      const m = r.model_permaslug || "unknown";
      modelMap[m] = (modelMap[m] || 0) + (r.cost_total || 0) * rate;
    });
    const costByModel = Object.entries(modelMap)
      .map(([fullModel, cost]) => ({ model: fullModel.split("/").pop() || fullModel, fullModel, cost }))
      .sort((a, b) => b.cost - a.cost);

    // Cost by provider
    const provMap: Record<string, { cost: number; count: number }> = {};
    rows.forEach((r: any) => {
      const p = r.provider_name || "unknown";
      if (!provMap[p]) provMap[p] = { cost: 0, count: 0 };
      provMap[p].cost += (r.cost_total || 0) * rate;
      provMap[p].count += 1;
    });
    const costByProvider = Object.entries(provMap)
      .map(([provider, v]) => ({ provider, cost: v.cost, requests: v.count }))
      .sort((a, b) => b.cost - a.cost);

    // Time series
    const dayMap: Record<string, { cost: number; tp: number; tc: number; tr: number; tca: number; gen: number; ttft: number; count: number }> = {};
    rows.forEach((r: any) => {
      const d = (r.created_at || "").slice(0, 10);
      if (!d) return;
      if (!dayMap[d]) dayMap[d] = { cost: 0, tp: 0, tc: 0, tr: 0, tca: 0, gen: 0, ttft: 0, count: 0 };
      dayMap[d].cost += (r.cost_total || 0) * rate;
      dayMap[d].tp += r.tokens_prompt || 0;
      dayMap[d].tc += r.tokens_completion || 0;
      dayMap[d].tr += r.tokens_reasoning || 0;
      dayMap[d].tca += r.tokens_cached || 0;
      dayMap[d].gen += r.generation_time_ms || 0;
      dayMap[d].ttft += r.time_to_first_token_ms || 0;
      dayMap[d].count += 1;
    });
    const timeSeries = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, v]) => ({
        time,
        cost: v.cost,
        model: "",
        tokens_prompt: v.tp,
        tokens_completion: v.tc,
        tokens_reasoning: v.tr,
        tokens_cached: v.tca,
        generation_time_ms: v.count ? v.gen / v.count : 0,
        time_to_first_token_ms: v.count ? v.ttft / v.count : 0,
      }));

    return { totalCost, totalRequests, totalTokens, avgGenTime, costByModel, costByProvider, timeSeries, rows };
  }, [data, currency, exchangeRate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background bg-mesh flex items-center justify-center">
        <div className="text-muted-foreground font-mono text-sm">Načítám sdílený dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background bg-mesh flex flex-col items-center justify-center gap-4">
        <div className="text-destructive font-mono text-sm">{error === "Share not found" ? "Sdílení nenalezeno" : error === "Share expired" ? "Platnost sdílení vypršela" : error}</div>
        <Link to="/">
          <Button variant="outline" className="font-mono text-xs">Zpět na úvod</Button>
        </Link>
      </div>
    );
  }

  if (!processed) return null;

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <header className="border-b border-white/[0.06] px-6 py-3 glass">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Activity className="h-4 w-4 text-white" />
            </Link>
            <h1 className="text-lg font-bold gradient-text tracking-tight">Sdílený Dashboard</h1>
            <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
              <Eye className="h-3 w-3" /> read-only
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">
              od {data?.owner}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCurrency}
              className="gap-1.5 border-border hover:bg-secondary hover:text-foreground font-mono text-xs min-w-[60px]"
            >
              {currency === "CZK" ? "Kč" : "$"}
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-4 max-w-[1600px] mx-auto">
        <KpiCards
          totalCost={processed.totalCost}
          totalRequests={processed.totalRequests}
          totalTokens={processed.totalTokens}
          avgGenTime={processed.avgGenTime}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CostTimeChart data={processed.timeSeries} />
          <TokensChart data={processed.timeSeries} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ModelCostChart data={processed.costByModel} onModelClick={() => {}} selectedModel={null} />
          <ProviderChart data={processed.costByProvider} />
          <SpeedChart data={processed.timeSeries} />
        </div>
        <RequestsTable data={processed.rows} />
      </main>
    </div>
  );
}
