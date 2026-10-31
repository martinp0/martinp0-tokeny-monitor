import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plug, Plus, RefreshCw, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/UpgradeModal";
import { FREE_LIMITS, proRequiredFeature } from "@/lib/plan";

// Only providers with a working server-side sync (see server/lib/sync-core.ts).
type ProviderId = "openrouter" | "anthropic" | "openai";

/** Order of providers in the picker. */
const SUPPORTED_PROVIDERS: ProviderId[] = ["openrouter", "anthropic", "openai"];

interface Credential {
  id: string;
  provider: ProviderId;
  label: string;
  key_preview: string;
  enabled: boolean;
  organization_id: string | null;
  last_synced_at: string | null;
  last_sync_status: "ok" | "error" | "running" | null;
  last_sync_error: string | null;
  rows_imported: number;
}

const PROVIDER_META: Record<ProviderId, { label: string; hint: string; docsUrl: string; keyPlaceholder: string }> = {
  openrouter: {
    label: "OpenRouter",
    hint: "Vyžaduje Management API klíč (openrouter.ai → Settings → Management keys). Stahuje denní využití za posledních 30 dní.",
    docsUrl: "https://openrouter.ai/settings/management-keys",
    keyPlaceholder: "sk-or-v1-…",
  },
  anthropic: {
    label: "Anthropic",
    hint: "Vyžaduje Admin API klíč (sk-ant-admin01-…). Vytvoř v Console → Admin Keys.",
    docsUrl: "https://console.anthropic.com/settings/admin-keys",
    keyPlaceholder: "sk-ant-admin01-…",
  },
  openai: {
    label: "OpenAI",
    hint: "Vyžaduje Admin API klíč. Vytvoř v platform.openai.com → Organization → Admin keys.",
    docsUrl: "https://platform.openai.com/settings/organization/admin-keys",
    keyPlaceholder: "sk-…",
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function ProviderConnections() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [label, setLabel] = useState("Default");
  const [apiKey, setApiKey] = useState("");
  const [orgId, setOrgId] = useState("");
  const [saving, setSaving] = useState(false);
  const { isPro, loading: planLoading } = useSubscription();
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  // Free plan: 1 provider. Mirrors the server check in save-provider-credential / user-sync.
  const atFreeLimit = !planLoading && !isPro && credentials.length >= FREE_LIMITS.providers;
  const syncableIds = new Set(isPro ? credentials.map((c) => c.id) : credentials.slice(0, FREE_LIMITS.providers).map((c) => c.id));

  async function load() {
    setLoading(true);
    try {
      const { credentials: data } = await api<{ credentials: Credential[] }>("/credentials");
      // Ignore credentials of providers that are no longer supported (removed stub providers).
      setCredentials((data ?? []).filter((c) => c.provider in PROVIDER_META));
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) {
      toast.error("Zadej API klíč");
      return;
    }
    setSaving(true);
    try {
      await api("/credentials", {
        body: {
          provider,
          label: label || "Default",
          api_key: apiKey.trim(),
          organization_id: orgId.trim() || null,
        },
      });
    } catch (error) {
      setSaving(false);
      const proFeature = await proRequiredFeature(error);
      if (proFeature) {
        setDialogOpen(false);
        setUpgradeFeature(proFeature);
        return;
      }
      toast.error(errorMessage(error));
      return;
    }
    setSaving(false);
    toast.success(`${PROVIDER_META[provider].label} klíč uložen`);
    setDialogOpen(false);
    setApiKey("");
    setOrgId("");
    setLabel("Default");
    await load();
  }

  async function handleDelete(id: string) {
    try {
      await api(`/credentials/${id}`, { method: "DELETE" });
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }
    toast.success("Smazáno");
    await load();
  }

  async function handleSync(c: Credential) {
    setSyncingId(c.id);
    let data: { inserted?: number };
    try {
      data = await api<{ inserted?: number }>(`/credentials/${c.id}/sync`, { body: {} });
    } catch (error) {
      setSyncingId(null);
      const proFeature = await proRequiredFeature(error);
      if (proFeature) {
        setUpgradeFeature(proFeature);
        return;
      }
      toast.error(`${PROVIDER_META[c.provider].label}: ${errorMessage(error)}`);
      await load();
      return;
    }
    setSyncingId(null);
    toast.success(`${PROVIDER_META[c.provider].label}: importováno ${data?.inserted ?? 0} řádků`);
    await load();
  }

  return (
    <Card className="glass border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4 text-primary" /> API integrace
        </CardTitle>
        <UpgradeModal
          open={!!upgradeFeature}
          onOpenChange={(o) => !o && setUpgradeFeature(null)}
          feature={upgradeFeature ?? undefined}
        />
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            // Free plan already has its one provider → offer Pro instead of a form that would 403.
            if (o && atFreeLimit) setUpgradeFeature("multi_provider");
            else setDialogOpen(o);
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Přidat klíč
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Připojit API providera</DialogTitle>
              <DialogDescription>
                Klíč se na serveru zašifruje (Supabase Vault) a nikdy se neposílá zpět do prohlížeče, uvidíš jen poslední 4 znaky.
                Sync běží na serveru přes Edge Function.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-xs">Provider</Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {SUPPORTED_PROVIDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProvider(p)}
                      className={`tap-target rounded-xl border px-3 py-2 text-sm transition ${
                        provider === p
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {PROVIDER_META[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{PROVIDER_META[provider].hint}{" "}
                <a className="text-primary underline" href={PROVIDER_META[provider].docsUrl} target="_blank" rel="noreferrer">Otevřít</a>
              </p>

              <div>
                <Label className="text-xs">Štítek</Label>
                <Input
                  className="mt-1 tabular-nums"
                  placeholder="Default"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">API klíč</Label>
                <Input
                  className="mt-1 tabular-nums"
                  type="password"
                  placeholder={PROVIDER_META[provider].keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {(provider === "anthropic" || provider === "openai") && (
                <div>
                  <Label className="text-xs">Organization ID (volitelné)</Label>
                  <Input
                    className="mt-1 tabular-nums"
                    placeholder="org-xxxxxx"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Zrušit</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Ukládám…" : "Uložit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="space-y-2">
        {loading && (
          <div className="text-xs text-muted-foreground tabular-nums">Načítám…</div>
        )}
        {!loading && credentials.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Zatím žádné napojení. Přidej první API klíč pro automatický import.
          </div>
        )}
        {!planLoading && !isPro && credentials.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Free: 1 poskytovatel, ruční sync, posledních 30 dní.{" "}
            <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setUpgradeFeature("auto_sync")}>
              Pro synchronizuje automaticky každou hodinu.
            </button>
          </p>
        )}
        {credentials.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{PROVIDER_META[c.provider].label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="tabular-nums text-xs">{c.label}</span>
                <code className="text-xs font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                  {c.key_preview}
                </code>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs tabular-nums text-muted-foreground">
                {c.last_sync_status === "ok" && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    {c.rows_imported} řádků
                  </span>
                )}
                {c.last_sync_status === "error" && (
                  <span className="flex items-center gap-1 text-destructive" title={c.last_sync_error ?? ""}>
                    <AlertCircle className="h-3 w-3" /> chyba
                  </span>
                )}
                {c.last_sync_status === "running" && <span>běží…</span>}
                {c.last_synced_at && (
                  <span>· {new Date(c.last_synced_at).toLocaleString("cs-CZ")}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => (syncableIds.has(c.id) ? handleSync(c) : setUpgradeFeature("multi_provider"))}
                disabled={syncingId === c.id}
                title={syncableIds.has(c.id) ? undefined : "Další poskytovatelé se synchronizují jen v Pro"}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingId === c.id ? "animate-spin" : ""}`} />
                {syncableIds.has(c.id) ? "Sync" : "Pro"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleDelete(c.id)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
