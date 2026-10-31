import { useCallback, useEffect, useId, useState } from "react";
import { ExternalLink, KeyRound, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AiActive, AiKeyInfo, AiKeyState, AiProviderId, AiProviderInfo } from "@/lib/ai-key";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError && typeof e.body?.error === "string" ? e.body.error : fallback;

/** Inline form to add / replace one provider's key, with explicit consent. */
function KeyForm({ provider, onSaved, onCancel }: { provider: AiProviderInfo; onSaved: (active: AiActive | null) => void; onCancel: () => void }) {
  const inputId = useId();
  const consentId = useId();
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ key: AiKeyInfo; verified: boolean; active: AiActive | null }>("/ai-key", {
        method: "PUT",
        body: { provider: provider.id, api_key: value.trim() },
      });
      setValue("");
      toast.success(r.verified ? `Klíč ${provider.label} uložen a ověřen.` : `Klíč ${provider.label} uložen. Ověřit ho teď nešlo, zkus AI asistenta.`);
      onSaved(r.active);
    } catch (e) {
      toast.error(errorText(e, "Klíč se nepodařilo uložit."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-2xl border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (consent && value.trim()) void save();
      }}
    >
      <div>
        <Label htmlFor={inputId} className="text-xs">API klíč {provider.label}</Label>
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={`${provider.keyPrefix}…`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 font-mono"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Běžný API klíč, ne Admin / Management klíč pro sledování nákladů. Vytvoříš ho na{" "}
          <a href={provider.keysUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
            {new URL(provider.keysUrl).host} <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          . Doporučujeme tam nastavit limit útraty.
        </p>
      </div>
      <div className="flex items-start gap-2.5">
        <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <label htmlFor={consentId} className="text-xs leading-snug text-muted-foreground">
          Souhlasím, že Tokeny tímto klíčem volá API {provider.label} na můj účet, když použiju AI funkce, a že náklady
          platím přímo {provider.label}.
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !consent || !value.trim()}>
          {saving ? "Ověřuji…" : "Uložit klíč"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Zrušit</Button>
      </div>
    </form>
  );
}

/** Which of the user's keys the AI uses, and with which model. */
function ActivePicker({ state, onChange }: { state: AiKeyState; onChange: (a: AiActive | null) => void }) {
  const modelId = useId();
  const listId = useId();
  const withKeys = state.providers.filter((p) => state.keys.some((k) => k.provider === p.id));
  const [provider, setProvider] = useState<AiProviderId | undefined>(state.active?.provider);
  const [model, setModel] = useState(state.active?.model ?? "");
  const [live, setLive] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const info = state.providers.find((p) => p.id === provider);

  useEffect(() => {
    setProvider(state.active?.provider);
    setModel(state.active?.model ?? "");
  }, [state.active?.provider, state.active?.model]);

  useEffect(() => {
    setLive([]);
    if (!provider) return;
    api<{ models: string[] | null }>(`/ai-models?provider=${provider}`)
      .then((r) => setLive(r.models ?? []))
      .catch(() => {});
  }, [provider]);

  if (withKeys.length === 0 || !info) return null;
  const dirty = provider !== state.active?.provider || model.trim() !== state.active?.model;

  async function save() {
    setSaving(true);
    try {
      const r = await api<{ active: AiActive }>("/ai-settings", { method: "PUT", body: { provider, model: model.trim() || info!.defaultModel } });
      onChange(r.active);
      toast.success(`AI teď používá ${info!.label} · ${r.active.model}.`);
    } catch (e) {
      toast.error(errorText(e, "Nastavení se nepodařilo uložit."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border p-3">
      <div className="text-xs font-medium text-foreground">Který klíč a model AI používá</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Poskytovatel</Label>
          <Select
            value={provider}
            onValueChange={(v) => {
              const p = v as AiProviderId;
              setProvider(p);
              setModel(state.providers.find((x) => x.id === p)?.defaultModel ?? "");
            }}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {withKeys.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={modelId} className="text-xs">Model</Label>
          <Input id={modelId} list={listId} value={model} onChange={(e) => setModel(e.target.value)} spellCheck={false} className="mt-1 font-mono text-xs" />
          <datalist id={listId}>
            {[...new Set([...info.models.map((m) => m.id), ...live])].map((id) => <option key={id} value={id} />)}
          </datalist>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Doporučený levný model: <button type="button" className="font-mono text-primary hover:underline" onClick={() => setModel(info.defaultModel)}>{info.defaultModel}</button>.
        Dražší modely stojí víc, platíš je přímo {info.label}.
      </p>
      <Button size="sm" onClick={save} disabled={saving || !dirty}>{saving ? "Ukládám…" : "Uložit volbu"}</Button>
    </div>
  );
}

/** Settings card: the user's own AI keys (Anthropic, OpenAI, OpenRouter) for the assistant and Fun page. */
export function AiKeySettings() {
  const [state, setState] = useState<AiKeyState | null>(null);
  const [editing, setEditing] = useState<AiProviderId | null>(null);

  const load = useCallback(() => api<AiKeyState>("/ai-key").then(setState).catch(() => setState({ keys: [], active: null, providers: [] })), []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (state && window.location.hash === "#ai-key") document.getElementById("ai-key")?.scrollIntoView({ block: "start" });
  }, [state]);

  async function remove(p: AiProviderInfo) {
    try {
      await api(`/ai-key?provider=${p.id}`, { method: "DELETE" });
      toast.success(`Klíč ${p.label} odebrán. Nezapomeň ho případně zneplatnit i u ${p.label}.`);
      await load();
    } catch {
      toast.error("Klíč se nepodařilo odebrat.");
    }
  }

  return (
    <Card id="ai-key" className="glass border-border scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> AI klíče (vlastní)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground leading-relaxed">
          AI asistent a AI zábava běží na <strong className="text-foreground">tvém vlastním API klíči</strong> u Anthropic,
          OpenAI nebo OpenRouter. Za AI platíš přímo zvolenému poskytovateli podle jeho ceníku, Tokeny si za ni nic neúčtuje.
          Tvoje zprávy asistentovi a souhrny tvých nákladů posíláme jen poskytovateli, kterého zvolíš. Klíče ukládáme
          zašifrované a zobrazujeme jen poslední 4 znaky.
        </p>

        {!state ? (
          <div className="h-9 w-48 rounded bg-secondary/40 animate-pulse" />
        ) : (
          <>
            <div className="space-y-2">
              {state.providers.map((p) => {
                const k = state.keys.find((x) => x.provider === p.id);
                if (editing === p.id) {
                  return (
                    <KeyForm
                      key={p.id}
                      provider={p}
                      onCancel={() => setEditing(null)}
                      onSaved={() => { setEditing(null); void load(); }}
                    />
                  );
                }
                return (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3">
                    <div>
                      <div className="font-medium">
                        {p.label}
                        {state.active?.provider === p.id && <span className="ml-2 text-xs text-primary">aktivní</span>}
                      </div>
                      {k ? (
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">{k.key_preview}</span> ·{" "}
                          {k.last_used_at ? `naposledy použit ${new Date(k.last_used_at).toLocaleString("cs-CZ")}` : "zatím nepoužit"}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Bez klíče</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {k ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditing(p.id)}>Vyměnit</Button>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => remove(p)}>
                            <Trash2 className="h-3.5 w-3.5" /> Odebrat
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(p.id)}>
                          <Plus className="h-3.5 w-3.5" /> Přidat klíč
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <ActivePicker state={state} onChange={(active) => setState({ ...state, active })} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
