import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

type ProviderId = "openrouter" | "anthropic" | "openai";

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
    hint: "Načti svůj API klíč z openrouter.ai/keys. Stahuje per-request data.",
    docsUrl: "https://openrouter.ai/keys",
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

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("provider_credentials")
      .select(
        "id, provider, label, key_preview, enabled, organization_id, last_synced_at, last_sync_status, last_sync_error, rows_imported",
      )
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setCredentials((data ?? []) as Credential[]);
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
    const { data, error } = await supabase.functions.invoke("save-provider-credential", {
      body: {
        provider,
        label: label || "Default",
        api_key: apiKey.trim(),
        organization_id: orgId.trim() || null,
      },
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    toast.success(`${PROVIDER_META[provider].label} klíč uložen`);
    setDialogOpen(false);
    setApiKey("");
    setOrgId("");
    setLabel("Default");
    await load();
  }

  async function handleDelete(id: string) {
    const { error } = await (supabase as any).from("provider_credentials").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Smazáno");
    await load();
  }

  async function handleSync(c: Credential) {
    setSyncingId(c.id);
    const fnName =
      c.provider === "anthropic"
        ? "sync-anthropic"
        : c.provider === "openai"
          ? "sync-openai"
          : "sync-openrouter";
    const { data, error } = await supabase.functions.invoke(fnName, {
      body: { credential_id: c.id },
    });
    setSyncingId(null);
    if (error) {
      toast.error(error.message);
      await load();
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      await load();
      return;
    }
    toast.success(`${PROVIDER_META[c.provider].label}: importováno ${data?.inserted ?? 0} řádků`);
    await load();
  }

  return (
    <Card className="glass border-white/[0.06]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4 text-primary" /> API integrace
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Přidat klíč
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Připojit API providera</DialogTitle>
              <DialogDescription>
                Klíč je uložen v zabezpečené tabulce — nikdy se neposílá zpět do prohlížeče.
                Sync běží na serveru přes Edge Function.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-xs">Provider</Label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {(Object.keys(PROVIDER_META) as ProviderId[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setProvider(p)}
                      className={`rounded-lg border px-3 py-2 text-sm font-mono transition ${
                        provider === p
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-white/[0.06] bg-secondary/30 text-muted-foreground hover:text-foreground"
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
                  className="mt-1 font-mono"
                  placeholder="Default"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">API klíč</Label>
                <Input
                  className="mt-1 font-mono"
                  type="password"
                  placeholder={PROVIDER_META[provider].keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {provider !== "openrouter" && (
                <div>
                  <Label className="text-xs">Organization ID (volitelné)</Label>
                  <Input
                    className="mt-1 font-mono"
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
          <div className="text-xs text-muted-foreground font-mono">Načítám…</div>
        )}
        {!loading && credentials.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/[0.08] p-4 text-center text-sm text-muted-foreground">
            Zatím žádné napojení. Přidej první API klíč pro automatický import.
          </div>
        )}
        {credentials.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{PROVIDER_META[c.provider].label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-mono text-xs">{c.label}</span>
                <code className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                  {c.key_preview}
                </code>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                {c.last_sync_status === "ok" && (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {c.rows_imported} řádků
                  </span>
                )}
                {c.last_sync_status === "error" && (
                  <span className="flex items-center gap-1 text-red-400" title={c.last_sync_error ?? ""}>
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
                onClick={() => handleSync(c)}
                disabled={syncingId === c.id}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingId === c.id ? "animate-spin" : ""}`} />
                Sync
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
