import { useEffect, useId, useState } from "react";
import { ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { ANTHROPIC_KEYS_URL, type AiKeyInfo } from "@/lib/ai-key";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Settings card: the user's own Anthropic key for the AI assistant and the Fun page (BYOK). */
export function AiKeySettings() {
  const inputId = useId();
  const consentId = useId();
  const [info, setInfo] = useState<AiKeyInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ key: AiKeyInfo | null }>("/ai-key")
      .then((r) => setInfo(r.key))
      .catch(() => setInfo(null))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded && window.location.hash === "#ai-key") document.getElementById("ai-key")?.scrollIntoView({ block: "start" });
  }, [loaded]);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ key: AiKeyInfo; verified: boolean }>("/ai-key", { method: "PUT", body: { provider: "anthropic", api_key: value.trim() } });
      setInfo(r.key);
      setValue("");
      setConsent(false);
      setEditing(false);
      toast.success(r.verified ? "Klíč uložen a ověřen." : "Klíč uložen. Ověřit ho teď nešlo, zkus AI asistenta.");
    } catch (e) {
      toast.error(e instanceof ApiError && typeof e.body?.error === "string" ? e.body.error : "Klíč se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await api("/ai-key", { method: "DELETE" });
      setInfo(null);
      toast.success("Klíč odebrán. Nezapomeň ho případně zneplatnit i v Anthropic Console.");
    } catch {
      toast.error("Klíč se nepodařilo odebrat.");
    }
  }

  const showForm = editing || (loaded && !info);

  return (
    <Card id="ai-key" className="glass border-border scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> AI klíč (Anthropic)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          AI asistent a AI zábava běží na <strong className="text-foreground">tvém vlastním API klíči Anthropic</strong>. Za AI
          platíš přímo Anthropicu podle jejich ceníku, Tokeny si za ni nic neúčtuje. Tvoje zprávy asistentovi a souhrny tvých
          nákladů posíláme jen Anthropicu. Klíč ukládáme zašifrovaný a zobrazujeme jen poslední 4 znaky.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Potřebuješ běžný API klíč (sk-ant-api…), ne Admin klíč, který používáš pro sledování nákladů. Vytvoříš ho v{" "}
          <a href={ANTHROPIC_KEYS_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
            console.anthropic.com <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          . Doporučujeme si tam nastavit i limit útraty.
        </p>

        {!loaded ? (
          <div className="h-9 w-48 rounded bg-secondary/40 animate-pulse" />
        ) : info && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3">
            <div>
              <div className="font-mono tabular-nums">{info.key_preview}</div>
              <div className="text-xs text-muted-foreground">
                {info.last_used_at ? `Naposledy použit ${new Date(info.last_used_at).toLocaleString("cs-CZ")}` : "Zatím nepoužit"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Vyměnit</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={remove}>
                <Trash2 className="h-3.5 w-3.5" /> Odebrat
              </Button>
            </div>
          </div>
        ) : null}

        {showForm && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (consent && value.trim()) void save();
            }}
          >
            <div>
              <Label htmlFor={inputId} className="text-xs">API klíč Anthropic</Label>
              <Input
                id={inputId}
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-ant-api03-…"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              <label htmlFor={consentId} className="text-xs leading-snug text-muted-foreground">
                Souhlasím, že Tokeny tímto klíčem volá Anthropic API na můj účet, když použiju AI funkce, a že náklady
                platím přímo Anthropicu.
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving || !consent || !value.trim()}>
                {saving ? "Ověřuji…" : "Uložit klíč"}
              </Button>
              {editing && (
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setValue(""); setConsent(false); }}>
                  Zrušit
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
