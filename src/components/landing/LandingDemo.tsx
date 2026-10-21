import { useEffect } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useCurrency } from "@/hooks/useCurrency";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CostTimeChart } from "@/components/dashboard/CostTimeChart";
import { TokensChart } from "@/components/dashboard/TokensChart";
import { ModelCostChart } from "@/components/dashboard/ModelCostChart";
import { ProviderChart } from "@/components/dashboard/ProviderChart";
import { SpeedChart } from "@/components/dashboard/SpeedChart";
import { RequestsTable } from "@/components/dashboard/RequestsTable";

export default function LandingDemo() {
  const { prefetchExchangeRate } = useCurrency();
  const {
    filteredData,
    selectedModel,
    setSelectedModel,
    totalCost,
    totalRequests,
    totalTokens,
    avgGenTime,
    costByModel,
    costByProvider,
    timeSeries,
  } = useDashboardData({ demoMode: true });

  useEffect(() => {
    prefetchExchangeRate();
  }, [prefetchExchangeRate]);

  return (
    <div className="space-y-4 rounded-2xl glass border-white/[0.08] p-3 sm:p-4 md:p-6 glow-sm min-w-0 max-w-full overflow-hidden">
      <KpiCards
        totalCost={totalCost}
        totalRequests={totalRequests}
        totalTokens={totalTokens}
        avgGenTime={avgGenTime}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <div className="min-w-0 overflow-hidden">
          <CostTimeChart data={timeSeries} />
        </div>
        <div className="min-w-0 overflow-hidden">
          <TokensChart data={timeSeries} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <div className="min-w-0 overflow-hidden">
          <ModelCostChart data={costByModel} onModelClick={setSelectedModel} selectedModel={selectedModel} />
        </div>
        <div className="min-w-0 overflow-hidden">
          <ProviderChart data={costByProvider} />
        </div>
        <div className="min-w-0 overflow-hidden">
          <SpeedChart data={timeSeries} />
        </div>
      </div>
      <div className="min-w-0 max-w-full overflow-hidden">
        <RequestsTable data={filteredData} />
      </div>
    </div>
  );
}
