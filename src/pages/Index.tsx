import { useDashboardData } from "@/hooks/useDashboardData";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CostTimeChart } from "@/components/dashboard/CostTimeChart";
import { TokensChart } from "@/components/dashboard/TokensChart";
import { ModelCostChart } from "@/components/dashboard/ModelCostChart";
import { ProviderChart } from "@/components/dashboard/ProviderChart";
import { SpeedChart } from "@/components/dashboard/SpeedChart";
import { RequestsTable } from "@/components/dashboard/RequestsTable";
import { CsvUpload } from "@/components/dashboard/CsvUpload";
import { Activity } from "lucide-react";

const Index = () => {
  const {
    filteredData, fileName, selectedModel, setSelectedModel, loadCSV,
    totalCost, totalRequests, totalTokens, avgGenTime, dateRange,
    costByModel, costByProvider, timeSeries,
  } = useDashboardData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">OpenRouter Monitor</h1>
            {selectedModel && (
              <span className="text-xs font-mono bg-primary/15 text-primary px-2 py-0.5 rounded">
                {selectedModel.split("/").pop()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {dateRange && (
              <span className="text-xs font-mono text-muted-foreground">
                {dateRange.from.substring(0, 10)} → {dateRange.to.substring(0, 10)}
              </span>
            )}
            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{fileName}</span>
            <CsvUpload onUpload={loadCSV} />
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <main className="p-6 space-y-4 max-w-[1600px] mx-auto">
        <KpiCards totalCost={totalCost} totalRequests={totalRequests} totalTokens={totalTokens} avgGenTime={avgGenTime} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CostTimeChart data={timeSeries} />
          <TokensChart data={timeSeries} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ModelCostChart data={costByModel} onModelClick={setSelectedModel} selectedModel={selectedModel} />
          <ProviderChart data={costByProvider} />
          <SpeedChart data={timeSeries} />
        </div>

        <RequestsTable data={filteredData} />
      </main>
    </div>
  );
};

export default Index;
