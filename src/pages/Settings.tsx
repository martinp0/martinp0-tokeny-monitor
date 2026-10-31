import { useEffect, useState, useId } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Key, Plus, Trash2, Copy, Terminal, Zap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { ProviderConnections } from "@/components/dashboard/ProviderConnections";
import { useSubscription } from "@/hooks/useSubscription";
import { ProBadge } from "@/components/ProBadge";
import { PRICING, formatCzk } from "@/config/pricing";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UpgradeModal } from "@/components/UpgradeModal";
import { ProGate } from "@/components/ProGate";
import type { BillingInterval } from "@/config/pricing";
import { McpClientGuides } from "@/components/settings/McpClientGuides";
import { mcpServerUrl } from "@/lib/public-urls";
import { AiKeySettings } from "@/components/ai/AiKeySettings";
import { BudgetSettings } from "@/components/settings/BudgetSettings";
import { ShareLinksSettings } from "@/components/settings/ShareLinksSettings";

interface McpToken {
  id: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
}

const Settings = () => {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isPro,
    loading: subLoading,
    status: subStatus,
    interval: subInterval,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    hasCustomer,
    openPortal,
    refresh: refreshSub,
  } = useSubscription();
  const upgradeParam = searchParams.get("upgrade");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(!!upgradeParam);
  const [upgradeInterval] = useState<BillingInterval>(upgradeParam === "monthly" || upgradeParam === "month" ? "month" : "year");
  const [portalLoading, setPortalLoading] = useState(false);
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("Claude Desktop");

  useEffect(() => {
    if (!session) return;
    void load();
  }, [session]);

  // Deep links like /settings#budget or /settings#ai-key: scroll once the cards have rendered.
  useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!id || subLoading) return;
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => window.clearTimeout(timer);
  }, [subLoading]);

  // Handle Stripe redirect
  useEffect(() => {
    const result = searchParams.get("checkout");
    const timers: number[] = [];
    if (result === "success") {
      toast.success("Děkuju! Tokeny Pro se aktivuje během pár vteřin.");
      // The webhook may land a moment after the redirect — re-check a few times.
      refreshSub();
      for (const ms of [2500, 6000, 12000]) timers.push(window.setTimeout(refreshSub, ms));
    } else if (result === "canceled") {
      toast.info("Platba zrušena.");
    }
    if (result || searchParams.get("upgrade")) {
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      next.delete("upgrade");
      setSearchParams(next, { replace: true });
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePortal() {
    setPortalLoading(true);
    await openPortal();
    setPortalLoading(false);
  }

  async function load() {
    try {
      const { tokens: t } = await api<{ tokens: McpToken[] }>("/mcp-tokens");
      setTokens(t ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function createToken() {
    let data: { token?: string };
    try {
      data = await api<{ token?: string }>("/mcp-tokens", { body: { name: tokenName } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return;
    }
    setNewToken(data.token ?? null);
    void load();
  }

  async function deleteToken(id: string) {
    try {
      await api(`/mcp-tokens/${id}`, { method: "DELETE" });
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  const mcpUrl = mcpServerUrl();

  const tokenNameId = useId();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Nastavení – rozpočet, upozornění a MCP tokeny | Tokeny</title>
        <meta name="description" content="Spravuj měsíční rozpočet a upozornění, MCP tokeny pro Grok Bot, Claude, Cursor a Zed a propojené API providery." />
        <link rel="canonical" href="https://tokeny.martinpohl.cz/settings" />
        <meta name="robots" content="noindex,nofollow" />
        <meta property="og:title" content="Nastavení – Tokeny" />
        <meta property="og:description" content="Rozpočet a upozornění, MCP tokeny a propojení API providerů v Tokenech." />
        <meta property="og:url" content="https://tokeny.martinpohl.cz/settings" />
      </Helmet>
      <header className="sticky top-0 z-40 glass-bar pt-safe px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Zpět na dashboard
          </Link>
          <div className="flex items-center gap-1">
            <h1 className="text-[17px] font-semibold tracking-tight mr-1">Nastavení</h1>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary" /> Předplatné
              {!subLoading && isPro && <ProBadge />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subLoading ? (
              <div className="h-8 w-32 rounded bg-secondary/40 animate-pulse" />
            ) : isPro ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tvůj plán: <span className="font-semibold text-foreground">Pro</span>
                  {subInterval && (
                    <span className="ml-1">({subInterval === "year" ? "ročně" : "měsíčně"})</span>
                  )}
                  {cancelAtPeriodEnd && (
                    <span className="ml-2 text-xs text-warning tabular-nums">(nekončí obnovením)</span>
                  )}
                </p>
                {subStatus === "past_due" && (
                  <p className="text-xs text-warning" role="status">
                    Poslední platba se nezdařila. Aktualizuj prosím platební kartu, ať o Pro nepřijdeš.
                  </p>
                )}
                {currentPeriodEnd && (
                  <p className="tabular-nums text-xs text-muted-foreground">
                    {subStatus === "trialing"
                      ? "Zkušební období do: "
                      : cancelAtPeriodEnd
                        ? "Pro platí do: "
                        : "Obnovení: "}
                    {new Date(currentPeriodEnd).toLocaleDateString("cs-CZ")}
                  </p>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePortal} disabled={portalLoading}>
                  <ExternalLink className="h-3.5 w-3.5" /> {portalLoading ? "Otevírám…" : "Spravovat předplatné"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Změna měsíčně/ročně, platební karta, faktury a zrušení – přes zabezpečený portál Stripe.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Tvůj plán: <span className="font-semibold text-foreground">Free</span>
                  <span className="ml-1">· 1 poskytovatel, posledních 30 dní, import CSV</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1.5" onClick={() => setUpgradeModalOpen(true)}>
                    <Zap className="h-3.5 w-3.5" /> Pro – od {formatCzk(PRICING.pro.monthly)} / měsíc
                  </Button>
                  {hasCustomer && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePortal} disabled={portalLoading}>
                      <ExternalLink className="h-3.5 w-3.5" /> Faktury a platby
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <UpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} defaultInterval={upgradeInterval} />

        <ProviderConnections />

        <AiKeySettings />

        <BudgetSettings />
        <ShareLinksSettings />

        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-4 w-4 text-primary" /> MCP server – Grok Bot, Claude, Cursor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProGate feature="mcp">
            <div className="space-y-4">
            <div className="rounded-lg bg-secondary/40 p-3 space-y-2">
              <div className="text-xs text-muted-foreground tabular-nums uppercase flex items-center gap-1">
                <Terminal className="h-3 w-3" /> MCP endpoint
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono flex-1 truncate">{mcpUrl}</code>
                <Button variant="ghost" size="icon" aria-label="Zkopírovat MCP endpoint" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(mcpUrl); toast.success("Zkopírováno"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Label htmlFor={tokenNameId} className="sr-only">Název tokenu</Label>
              <Input id={tokenNameId} placeholder="Název tokenu" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
              <Button onClick={createToken} className="gap-1.5"><Plus className="h-4 w-4" /> Vytvořit token</Button>
            </div>

            {newToken && (
              <div className="rounded-lg bg-accent/10 border border-accent/30 p-3 space-y-2">
                <div className="text-xs font-semibold text-primary">⚠️ Token zobrazen jen jednou — zkopíruj si ho hned!</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono flex-1 break-all">{newToken}</code>
                  <Button variant="ghost" size="icon" aria-label="Zkopírovat token" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(newToken); toast.success("Zkopírováno"); }}>
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
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {t.last_used_at ? `Použit ${new Date(t.last_used_at).toLocaleString("cs-CZ")}` : "Nepoužit"}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Smazat token" className="h-7 w-7" onClick={() => deleteToken(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <McpClientGuides url={mcpUrl} />
            </div>
            </ProGate>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
