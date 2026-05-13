import { useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useExport } from "@/hooks/useExport";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CostTimeChart } from "@/components/dashboard/CostTimeChart";
import { TokensChart } from "@/components/dashboard/TokensChart";
import { ModelCostChart } from "@/components/dashboard/ModelCostChart";
import { ProviderChart } from "@/components/dashboard/ProviderChart";
import { SpeedChart } from "@/components/dashboard/SpeedChart";
import { RequestsTable } from "@/components/dashboard/RequestsTable";
import { RealLifeComparison } from "@/components/dashboard/RealLifeComparison";
import { CsvUpload } from "@/components/dashboard/CsvUpload";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker";
import { ModelComparison } from "@/components/dashboard/ModelComparison";
import { CostForecast } from "@/components/dashboard/CostForecast";
import { AnomalyPanel } from "@/components/dashboard/AnomalyPanel";
import { AiAgentChat, type AgentAction } from "@/components/dashboard/AiAgentChat";
import { ShareDashboardButton } from "@/components/dashboard/ShareDashboardButton";
import { OnboardingEmptyState } from "@/components/dashboard/OnboardingEmptyState";
import { Activity, Download, Image, FileText, LogOut, Settings as SettingsIcon, User, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChangelogModal } from "@/components/ChangelogModal";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Index = () => {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const {
    data, filteredData, fileName, selectedModel, setSelectedModel, loadCSV,
    dateFilter, setDateFilter, models,
    totalCost, totalRequests, totalTokens, avgGenTime,
    costByModel, costByProvider, timeSeries,
    hasUserData, loading,
  } = useDashboardData();
  const { exportPNG, exportPDF } = useExport(dashboardRef);
  const { currency, toggle: toggleCurrency, setCurrency, exchangeRate, rateDate } = useCurrency();
  const { signOut } = useAuth();

  const handleAgentAction = useCallback((a: AgentAction) => {
    if (a.name === "apply_filters") {
      if ("model" in a.args) {
        if (a.args.model === null) setSelectedModel(null);
        else if (typeof a.args.model === "string") {
          // try to match by suffix or exact
          const exact = models.find((m) => m === a.args.model);
          const suffix = models.find((m) => m.endsWith("/" + a.args.model) || m.includes(a.args.model));
          setSelectedModel(exact ?? suffix ?? a.args.model);
        }
      }
      if (a.args.from_date && a.args.to_date) {
        setDateFilter({ from: new Date(a.args.from_date), to: new Date(a.args.to_date) });
      } else if (a.args.from_date === null && a.args.to_date === null) {
        setDateFilter(null);
      }
      toast.success("Filtry aktualizovány AI agentem");
    } else if (a.name === "set_currency") {
      setCurrency(a.args.currency);
      toast.success(`Měna: ${a.args.currency}`);
    } else if (a.name === "export_data") {
      if (a.args.format === "png") exportPNG();
      else exportPDF(data, totalCost, totalRequests, totalTokens, avgGenTime);
    }
  }, [models, setSelectedModel, setDateFilter, setCurrency, exportPNG, exportPDF, data, totalCost, totalRequests, totalTokens, avgGenTime]);

  return (
    <div className="min-h-screen bg-background bg-mesh">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-4 md:px-6 py-3 glass">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Link to="/" className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center" title="Domů">
              <Activity className="h-4 w-4 text-white" />
            </Link>
            <h1 className="text-base md:text-lg font-bold gradient-text tracking-tight truncate">OpenRouter Monitor</h1>
            {selectedModel && (
              <span className="hidden sm:inline-block text-xs font-mono bg-primary/15 text-primary px-2 py-0.5 rounded-full truncate max-w-[160px]" title={selectedModel}>
                {(selectedModel.split("/").pop() || selectedModel).replace(/-(20\d{2})-?(\d{2})-?(\d{2})/g, "").slice(0, 28)}
              </span>
            )}
          </div>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCurrency}
                className="gap-1.5 border-border hover:bg-secondary hover:text-foreground font-mono text-xs min-w-[60px]"
              >
                {currency === "CZK" ? "Kč" : "$"}
              </Button>
              {currency === "CZK" && (
                <span className="text-[10px] text-muted-foreground font-mono" title={rateDate || undefined}>
                  1 USD = {exchangeRate.toFixed(2)} CZK
                </span>
              )}
            </div>
            <DateRangePicker value={dateFilter} onChange={setDateFilter} />
            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{fileName}</span>

            <CsvUpload onUpload={loadCSV} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-border hover:bg-secondary hover:text-foreground font-mono text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-border">
                <DropdownMenuItem onClick={exportPNG} className="gap-2 font-mono text-xs cursor-pointer">
                  <Image className="h-3.5 w-3.5" />
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPDF(data, totalCost, totalRequests, totalTokens, avgGenTime)} className="gap-2 font-mono text-xs cursor-pointer">
                  <FileText className="h-3.5 w-3.5" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ShareDashboardButton />
            <ChangelogModal />
            <LanguageSwitcher />
            <Link to="/profile">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground font-mono text-xs" title="Profil">
                <User className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link to="/settings">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground font-mono text-xs" title="Nastavení">
                <SettingsIcon className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="gap-1.5 text-muted-foreground hover:text-foreground font-mono text-xs"
              title="Odhlásit se"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="flex md:hidden items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleCurrency}
              className="h-8 px-2 border-border font-mono text-xs"
            >
              {currency === "CZK" ? "Kč" : "$"}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-card border-border overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-sm gradient-text">Menu</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Datum</p>
                    <DateRangePicker value={dateFilter} onChange={setDateFilter} />
                  </div>
                  {currency === "CZK" && (
                    <p className="text-[10px] text-muted-foreground font-mono">
                      1 USD = {exchangeRate.toFixed(2)} CZK
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Data</p>
                    <CsvUpload onUpload={loadCSV} />
                    {fileName && <p className="text-[10px] font-mono text-muted-foreground truncate">{fileName}</p>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Export</p>
                    <Button variant="outline" size="sm" onClick={exportPNG} className="w-full justify-start gap-2 font-mono text-xs">
                      <Image className="h-3.5 w-3.5" /> PNG
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportPDF(data, totalCost, totalRequests, totalTokens, avgGenTime)} className="w-full justify-start gap-2 font-mono text-xs">
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ostatní</p>
                    <ShareDashboardButton />
                    <div className="flex items-center gap-2">
                      <ChangelogModal />
                      <LanguageSwitcher />
                    </div>
                    <Link to="/profile" className="block">
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 font-mono text-xs">
                        <User className="h-3.5 w-3.5" /> Profil
                      </Button>
                    </Link>
                    <Link to="/settings" className="block">
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 font-mono text-xs">
                        <SettingsIcon className="h-3.5 w-3.5" /> Nastavení
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-2 font-mono text-xs">
                      <LogOut className="h-3.5 w-3.5" /> Odhlásit se
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Dashboard */}
      <main ref={dashboardRef} className="p-3 md:p-6 space-y-4 max-w-[1600px] mx-auto">
        {!loading && !hasUserData ? (
          <OnboardingEmptyState onUpload={loadCSV} />
        ) : (
          <>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CostForecast data={data} />
              <AnomalyPanel data={data} />
            </div>

            <ModelComparison data={filteredData} />

            <RealLifeComparison totalCostCzk={totalCost * exchangeRate} />

            <RequestsTable data={filteredData} />
          </>
        )}
      </main>

      <AiAgentChat onAction={handleAgentAction} />
    </div>
  );
};

export default Index;
