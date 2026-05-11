import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2, Copy, ExternalLink, Trash2, ImagePlus, ImageOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SharedRow {
  id: string;
  share_token: string;
  label: string | null;
  created_at: string;
  og_image_path: string | null;
}

const BUCKET = "og-images";

export function SharedDashboardsManager() {
  const { session } = useAuth();
  const [rows, setRows] = useState<SharedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shared_dashboards")
      .select("id, share_token, label, created_at, og_image_path")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as SharedRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  function publicUrl(path: string | null) {
    if (!path) return null;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function shareUrl(token: string) {
    return `${window.location.origin}/shared/${token}`;
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} zkopírováno`);
  }

  async function uploadOg(row: SharedRow, file: File) {
    if (!session) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Nahraj obrázek (PNG/JPG)");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Maximum 4 MB");
      return;
    }
    setBusyId(row.id);
    const ext = file.name.split(".").pop() || "png";
    const path = `${session.user.id}/${row.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      toast.error(upErr.message);
      setBusyId(null);
      return;
    }
    // Remove old
    if (row.og_image_path && row.og_image_path !== path) {
      await supabase.storage.from(BUCKET).remove([row.og_image_path]);
    }
    const { error: updErr } = await supabase
      .from("shared_dashboards")
      .update({ og_image_path: path })
      .eq("id", row.id);
    if (updErr) toast.error(updErr.message);
    else toast.success("OG obrázek nahrán");
    setBusyId(null);
    await load();
  }

  async function removeOg(row: SharedRow) {
    if (!row.og_image_path) return;
    setBusyId(row.id);
    await supabase.storage.from(BUCKET).remove([row.og_image_path]);
    await supabase.from("shared_dashboards").update({ og_image_path: null }).eq("id", row.id);
    setBusyId(null);
    toast.success("OG obrázek odstraněn (bude se generovat automaticky)");
    await load();
  }

  async function removeShare(row: SharedRow) {
    if (!confirm(`Smazat sdílení "${row.label || "Sdílený dashboard"}"?`)) return;
    setBusyId(row.id);
    if (row.og_image_path) await supabase.storage.from(BUCKET).remove([row.og_image_path]);
    const { error } = await supabase.from("shared_dashboards").delete().eq("id", row.id);
    setBusyId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Sdílení smazáno");
      await load();
    }
  }

  function autoOgUrl(token: string) {
    return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-dashboard?token=${token}`;
  }

  return (
    <Card className="glass border-white/[0.06]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" /> Sdílené dashboardy & OG obrázky
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pro každé sdílení můžeš nahrát vlastní náhledový obrázek (1200×630, max 4 MB), nebo nech systém generovat dynamický náhled s aktuálními KPI.
        </p>

        {loading ? (
          <div className="text-sm text-muted-foreground font-mono">Načítám…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
            Zatím nemáš žádné sdílené dashboardy. Vytvoř první kliknutím na <strong>Sdílet</strong> v dashboardu.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const url = shareUrl(row.share_token);
              const ogUrl = row.og_image_path ? publicUrl(row.og_image_path) : autoOgUrl(row.share_token);
              const isCustom = !!row.og_image_path;
              return (
                <div
                  key={row.id}
                  className="rounded-xl border border-white/10 bg-white/[0.02] p-3 grid gap-3 sm:grid-cols-[160px_1fr]"
                >
                  <a
                    href={ogUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-[1200/630] rounded-lg overflow-hidden bg-secondary/40 border border-white/5"
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
                      <span className="font-mono text-sm font-semibold truncate">
                        {row.label || "Sdílený dashboard"}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isCustom
                            ? "bg-accent/15 text-accent border border-accent/30"
                            : "bg-secondary/60 text-muted-foreground border border-white/10"
                        }`}
                      >
                        {isCustom ? "vlastní OG" : "auto OG"}
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
                      <input
                        ref={(el) => (fileInputs.current[row.id] = el)}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadOg(row, f);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs gap-1.5"
                        disabled={busyId === row.id}
                        onClick={() => fileInputs.current[row.id]?.click()}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {isCustom ? "Vyměnit obrázek" : "Nahrát vlastní"}
                      </Button>
                      {isCustom && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="font-mono text-xs gap-1.5"
                          disabled={busyId === row.id}
                          onClick={() => void removeOg(row)}
                        >
                          <ImageOff className="h-3.5 w-3.5" />
                          Použít automatický
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="font-mono text-xs gap-1.5 text-destructive hover:text-destructive"
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
