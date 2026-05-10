import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Bell, Key, Plus, Trash2, Copy, Terminal, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProviderConnections } from "@/components/dashboard/ProviderConnections";
import { useSubscription } from "@/hooks/useSubscription";
import { ProBadge } from "@/components/ProBadge";

interface BudgetAlert {
  id: string;
  monthly_budget_usd: number;
  notify_email: string | null;
  threshold_pct: number;
  enabled: boolean;
}

interface McpToken {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

const Settings = () => {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const { isPro, currentPeriodEnd, cancelAtPeriodEnd, loading: subLoading, startCheckout, refresh: refreshSub } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [alert, setAlert] = useState<BudgetAlert | null>(null);
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("Claude Desktop");
  const [budget, setBudget] = useState("50");
  const [threshold, setThreshold] = useState("80");
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session]);

  // Handle Stripe redirect
  useEffect(() => {
    const result = searchParams.get("checkout");
    if (result === "success") {
      toast.success("Platba proběhla úspěšně! Pro tier aktivován.");
      void refreshSub();
    } else if (result === "canceled") {
      toast.info("Platba zrušena.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data: a } = await supabase.from("budget_alerts").select("*").maybeSingle();
    if (a) {
      setAlert(a as unknown as BudgetAlert);
      setBudget(String(a.monthly_budget_usd));
      setThreshold(String(a.threshold_pct));
      setEmail(a.notify_email ?? "");
      setEnabled(a.enabled);
    } else {
      setEmail(session?.user.email ?? "");
    }
    const { data: t } = await supabase.from("mcp_tokens").select("*").order("created_at", { ascending: false });
    setTokens((t as unknown as McpToken[]) ?? []);
  }

  async function saveAlert() {
    if (!session) return;
    const payload = {
      user_id: session.user.id,
      monthly_budget_usd: Number(budget),
      threshold_pct: Number(threshold),
      notify_email: email || null,
      enabled,
    };
    const { error } = alert
      ? await supabase.from("budget_alerts").update(payload).eq("id", alert.id)
      : await supabase.from("budget_alerts").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Uloženo");
      void load();
    }
  }

  async function createToken() {
    const { data, error } = await supabase.functions.invoke("create-mcp-token", { body: { name: tokenName } });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
      return;
    }
    setNewToken(data.token);
    void load();
  }

  async function deleteToken(id: string) {
    const { error } = await supabase.from("mcp_tokens").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  }

  const mcpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`;

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <header className="border-b border-white/[0.06] px-6 py-3 glass">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Zpět na dashboard
          </Link>
          <h1 className="text-lg font-bold gradient-text">Nastavení</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* ── Pro subscription card ── */}
        <Card className="glass border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Předplatné
              {isPro && <ProBadge className="ml-1" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
              </div>
            ) : isPro ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Pro tier aktivní
                  {cancelAtPeriodEnd && <span className="text-xs text-amber-400 font-mono">(zruší se na konci období)</span>}
                </div>
                {currentPeriodEnd && (
                  <div className="text-xs text-muted-foreground font-mono">
                    Platnost do: {new Date(currentPeriodEnd).toLocaleDateString("cs-CZ")}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  Free tier — odemkni Pro za $7 / měsíc
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0"
                  disabled={checkoutLoading}
                  onClick={async () => {
                    setCheckoutLoading(true);
                    try { await startCheckout(); }
                    catch { toast.error("Nepodařilo se otevřít platební bránu"); }
                    finally { setCheckoutLoading(false); }
                  }}
                >
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {checkoutLoading ? "Přesměrování…" : "Upgrade na Pro"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <ProviderConnections />

        <Card className="glass border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-accent" /> Budget alerty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Měsíční budget (USD)</Label>
                <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Alert při (%)</Label>
                <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Notifikační e-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 font-mono" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-sm">Alerty zapnuté</span>
              </div>
              <Button onClick={saveAlert}>Uložit</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4 text-primary" /> MCP server – přístup z Claude Desktop / Cursor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
              <div className="text-[10px] text-muted-foreground font-mono uppercase flex items-center gap-1">
                <Terminal className="h-3 w-3" /> MCP endpoint
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono flex-1 truncate">{mcpUrl}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(mcpUrl); toast.success("Zkopírováno"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Input placeholder="Název tokenu" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
              <Button onClick={createToken} className="gap-1.5"><Plus className="h-4 w-4" /> Vytvořit token</Button>
            </div>

            {newToken && (
              <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 space-y-2">
                <div className="text-xs font-semibold text-accent">⚠️ Token zobrazen jen jednou — zkopíruj si ho hned!</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono flex-1 break-all">{newToken}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(newToken); toast.success("Zkopírováno"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setNewToken(null)}>Skrýt</Button>
              </div>
            )}

            {tokens.length > 0 && (
              <div className="space-y-1.5">
                {tokens.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2">
                    <div>
                      <div className="text-sm">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {t.last_used_at ? `Použit ${new Date(t.last_used_at).toLocaleString("cs-CZ")}` : "Nepoužit"}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteToken(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <details className="rounded-lg bg-secondary/30 p-3">
              <summary className="text-xs font-semibold cursor-pointer">Návod: Claude Desktop config</summary>
              <pre className="mt-2 text-[10px] font-mono overflow-x-auto bg-background/50 p-2 rounded">
{`{
  "mcpServers": {
    "openrouter-monitor": {
      "url": "${mcpUrl}",
      "headers": { "Authorization": "Bearer <TVŮJ_TOKEN>" }
    }
  }
}`}
              </pre>
            </details>
          </CardContent>
        </Card>
      </main>

    </div>
  );
};

export default Settings;
