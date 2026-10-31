import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProGate } from "@/components/ProGate";
import { ShareDialog } from "@/components/share/ShareDialog";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { providerLabel } from "@/lib/budget";
import type { ShareLink } from "@/lib/share";

/**
 * Active read-only share links. Listing and revoking always work (also after Pro lapses, so a
 * user can clean up); creating a new link is Pro.
 */
export function ShareLinksSettings() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const [rows, setRows] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const locale = i18n.language?.startsWith("en") ? "en-GB" : "cs-CZ";
  const fmtDate = (s: string) => new Date(s).toLocaleDateString(locale, { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" });

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setRows((await api<{ shares: ShareLink[] }>("/shares")).shares ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  async function revoke(row: ShareLink) {
    if (!confirm(t("share.revokeConfirm", { label: row.label || t("share.untitled") }))) return;
    setBusy(row.id);
    try {
      await api(`/shares/${row.id}`, { method: "DELETE" });
      toast.success(t("share.revoked"));
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function scopeSummary(s: ShareLink["scope"]) {
    const p = s.period;
    const period = !p ? t("share.rolling30") : p.type === "rolling" ? t(`share.rolling${p.days}`) : p.type === "month" ? t("share.month") : `${p.from} – ${p.to}`;
    const prov = s.providers?.length ? s.providers.map(providerLabel).join(", ") : t("share.allProviders");
    return `${period} · ${prov} · ${s.show_amounts === false ? t("share.percentOnly") : `${t("share.amounts")} (${s.currency === "CZK" ? "Kč" : "USD"})`}`;
  }

  return (
    <Card id="sharing" className="glass border-border scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" aria-hidden /> {t("share.listTitle")}</span>
          <ProGate feature="sharing" compact>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" aria-hidden /> {t("share.new")}</Button>
          </ProGate>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t("share.warning")}</p>
        {loading ? null : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">{t("share.listEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const expired = !!r.expires_at && new Date(r.expires_at).getTime() <= Date.now();
              return (
                <li key={r.id} className="rounded-2xl border border-border bg-secondary/30 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{r.label || t("share.untitled")}</p>
                    <p className="text-xs text-muted-foreground">{scopeSummary(r.scope)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums flex flex-wrap gap-x-2">
                      <span>{fmtDate(r.created_at)}</span>
                      <span className={expired ? "text-destructive" : ""}>{r.expires_at ? (expired ? t("share.expired") : t("share.expires", { date: fmtDate(r.expires_at) })) : t("share.noExpiry")}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden />{t("share.views", { n: r.view_count })}</span>
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => void revoke(r)} className="text-destructive hover:text-destructive gap-1.5 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t("share.revoke")}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <ShareDialog open={open} onOpenChange={setOpen} onCreated={(s) => setRows((r) => [s, ...r])} />
    </Card>
  );
}
