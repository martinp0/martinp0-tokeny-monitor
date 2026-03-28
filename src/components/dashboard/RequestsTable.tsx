import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { type ActivityRow } from "@/lib/csv-parser";
import { ArrowUpDown, Search } from "lucide-react";

interface Props {
  data: ActivityRow[];
}

type SortKey = "created_at" | "cost_total" | "tokens_prompt" | "generation_time_ms" | "model_permaslug";

export function RequestsTable({ data }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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
                <TableRow key={row.generation_id} className="border-border/30 hover:bg-secondary/50 font-mono text-xs">
                  <TableCell className="text-muted-foreground">{row.created_at.substring(11, 19)}</TableCell>
                  <TableCell className="text-foreground max-w-[200px] truncate">{row.model_permaslug.split("/").pop()}</TableCell>
                  <TableCell className="text-muted-foreground">{row.provider_name}</TableCell>
                  <TableCell className="text-right text-chart-1">${row.cost_total.toFixed(6)}</TableCell>
                  <TableCell className="text-right text-chart-2">{(row.tokens_prompt + row.tokens_completion).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-chart-3">{row.generation_time_ms.toLocaleString()}</TableCell>
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
  );
}
