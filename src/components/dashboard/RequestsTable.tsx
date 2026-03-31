import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ActivityRow } from "@/lib/csv-parser";
import { fmtCost, fmtNum } from "@/lib/format";
import { useCurrency } from "@/hooks/useCurrency";
import { ArrowUpDown, Search } from "lucide-react";

interface Props {
  data: ActivityRow[];
}

type SortKey = "created_at" | "cost_total" | "tokens_prompt" | "generation_time_ms" | "model_permaslug";

function DetailRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-mono ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}

function RequestDetailModal({ row, open, onClose }: { row: ActivityRow | null; open: boolean; onClose: () => void }) {
  const { currency, exchangeRate } = useCurrency();
  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono text-foreground">
            {row.model_permaslug.split("/").pop()}
          </DialogTitle>
          <p className="text-xs text-muted-foreground font-mono">{row.generation_id}</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Timing */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Timing</h4>
            <div className="bg-secondary/50 rounded-md px-3 py-1">
              <DetailRow label="Created At" value={row.created_at} />
              <DetailRow label="Generation Time" value={`${fmtNum(row.generation_time_ms, currency)} ms`} color="text-chart-3" />
              <DetailRow label="Time to First Token" value={`${fmtNum(row.time_to_first_token_ms, currency)} ms`} color="text-chart-4" />
            </div>
          </div>

          {/* Model & Provider */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Model & Provider</h4>
            <div className="bg-secondary/50 rounded-md px-3 py-1">
              <DetailRow label="Model" value={row.model_permaslug} />
              <DetailRow label="Provider" value={row.provider_name} />
              <DetailRow label="Variant" value={row.variant || "—"} />
              <DetailRow label="App" value={row.app_name || "—"} />
              <DetailRow label="API Key" value={row.api_key_name || "—"} />
            </div>
          </div>

          {/* Costs */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Costs</h4>
            <div className="bg-secondary/50 rounded-md px-3 py-1">
              <DetailRow label="Celkové náklady" value={fmtCost(row.cost_total, 6, currency, exchangeRate)} color="text-chart-1" />
              <DetailRow label="Web Search" value={fmtCost(row.cost_web_search, 6, currency, exchangeRate)} />
              <DetailRow label="Cache" value={fmtCost(row.cost_cache, 6, currency, exchangeRate)} />
              <DetailRow label="File Processing" value={fmtCost(row.cost_file_processing, 6, currency, exchangeRate)} />
              <DetailRow label="BYOK Inference" value={fmtCost(row.byok_usage_inference, 6, currency, exchangeRate)} />
            </div>
          </div>

          {/* Tokens */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Tokens</h4>
            <div className="bg-secondary/50 rounded-md px-3 py-1">
              <DetailRow label="Prompt" value={fmtNum(row.tokens_prompt, currency)} color="text-chart-2" />
              <DetailRow label="Completion" value={fmtNum(row.tokens_completion, currency)} color="text-primary" />
              <DetailRow label="Reasoning" value={fmtNum(row.tokens_reasoning, currency)} color="text-chart-4" />
              <DetailRow label="Cached" value={fmtNum(row.tokens_cached, currency)} color="text-chart-3" />
            </div>
          </div>

          {/* Status */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Status</h4>
            <div className="bg-secondary/50 rounded-md px-3 py-1">
              <DetailRow label="Finish Reason" value={row.finish_reason_normalized} />
              <DetailRow label="Finish Reason (raw)" value={row.finish_reason_raw || "—"} />
              <DetailRow label="Streamed" value={row.streamed ? "Yes" : "No"} />
              <DetailRow label="Cancelled" value={row.cancelled ? "Yes" : "No"} />
              <DetailRow label="User" value={row.user || "—"} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RequestsTable({ data }: Props) {
  const { currency, exchangeRate } = useCurrency();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedRow, setSelectedRow] = useState<ActivityRow | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.model_permaslug.toLowerCase().includes(q) ||
        r.provider_name.toLowerCase().includes(q) ||
        r.generation_id.toLowerCase().includes(q) ||
        r.app_name.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [data, search, sortKey, sortDir]);

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <>
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Request Log</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search model, provider..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 bg-secondary border-border text-sm font-mono"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead><SortHeader label="Time" col="created_at" /></TableHead>
                  <TableHead><SortHeader label="Model" col="model_permaslug" /></TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right"><SortHeader label="Cost" col="cost_total" /></TableHead>
                  <TableHead className="text-right"><SortHeader label="Tokens" col="tokens_prompt" /></TableHead>
                  <TableHead className="text-right"><SortHeader label="Time (ms)" col="generation_time_ms" /></TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow
                    key={row.generation_id}
                    onClick={() => setSelectedRow(row)}
                    className="border-border/30 hover:bg-secondary/50 font-mono text-xs cursor-pointer"
                  >
                    <TableCell className="text-muted-foreground">{row.created_at.substring(11, 19)}</TableCell>
                    <TableCell className="text-foreground max-w-[200px] truncate">{row.model_permaslug.split("/").pop()}</TableCell>
                    <TableCell className="text-muted-foreground">{row.provider_name}</TableCell>
                    <TableCell className="text-right text-chart-1">{fmtCost(row.cost_total, 4, currency)}</TableCell>
                    <TableCell className="text-right text-chart-2">{fmtNum(row.tokens_prompt + row.tokens_completion, currency)}</TableCell>
                    <TableCell className="text-right text-chart-3">{fmtNum(row.generation_time_ms, currency)}</TableCell>
                    <TableCell>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                        row.finish_reason_normalized === "stop" ? "bg-primary/20 text-primary" :
                        row.finish_reason_normalized === "length" ? "bg-chart-3/20 text-chart-3" :
                        "bg-chart-4/20 text-chart-4"
                      }`}>
                        {row.finish_reason_normalized}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <RequestDetailModal
        row={selectedRow}
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </>
  );
}
