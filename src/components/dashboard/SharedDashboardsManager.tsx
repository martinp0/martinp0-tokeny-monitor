import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, Copy, ExternalLink, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ogDashboardUrl } from "@/lib/public-urls";

interface SharedRow {
  id: string;
  share_token: string;
  label: string | null;
  created_at: string;
}

export function SharedDashboardsManager() {
  const { session } = useAuth();
  const [rows, setRows] = useState<SharedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!session) return;
    setLoading(true);
    try {
      setRows((await api<{ shares: SharedRow[] }>("/shares")).shares ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  function shareUrl(token: string) {
    return `${window.location.origin}/shared/${token}`;
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} zkopírováno`);
  }

  async function removeShare(row: SharedRow) {
    if (!confirm(`Smazat sdílení "${row.label || "Sdílený dashboard"}"?`)) return;
    setBusyId(row.id);
    try {
      await api(`/shares/${row.id}`, { method: "DELETE" });
      toast.success("Sdílení smazáno");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function autoOgUrl(token: string) {
    return ogDashboardUrl(token);
  }

  return (
    <Card className="glass border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" /> Sdílené dashboardy & OG obrázky
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Každé sdílení má automaticky generovaný náhled (1200×630) s aktuálními KPI.
        </p>

        {loading ? (
          <div className="text-sm text-muted-foreground tabular-nums">Načítám…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Zatím nemáš žádné sdílené dashboardy. Vytvoř první kliknutím na <strong>Sdílet</strong> v dashboardu.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const url = shareUrl(row.share_token);
              const ogUrl = autoOgUrl(row.share_token);
              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-border bg-muted/60 p-3 grid gap-3 sm:grid-cols-[160px_1fr]"
                >
                  <a
                    href={ogUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-[1200/630] rounded-lg overflow-hidden bg-secondary/40 border border-border"
                  >
                    {ogUrl ? (
                      <img
                        src={ogUrl}
                        alt={`OG náhled ${row.label}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </a>
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="tabular-nums text-sm font-semibold truncate">
                        {row.label || "Sdílený dashboard"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <code className="font-mono truncate flex-1 text-muted-foreground">{url}</code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copy(url, "Odkaz")}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="tabular-nums text-xs gap-1.5 text-destructive hover:text-destructive"
                        disabled={busyId === row.id}
                        onClick={() => void removeShare(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Smazat sdílení
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
