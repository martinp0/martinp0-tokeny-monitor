import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Laugh, Image, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

type FunResult = { joke?: string; image?: string; text?: string };

function funError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.status === 401) return "Pro AI zábavu se nejdřív přihlas.";
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function Fun() {
  const [joke, setJoke] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loadingJoke, setLoadingJoke] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  const generateJoke = async () => {
    setLoadingJoke(true);
    try {
      const data = await api<FunResult>("/fun-ai", { body: { mode: "joke" } });
      setJoke(data.joke ?? null);
    } catch (e) {
      toast.error(funError(e, "Nepodařilo se vygenerovat vtip"));
    } finally {
      setLoadingJoke(false);
    }
  };

  const generateImage = async () => {
    setLoadingImage(true);
    setImage(null);
    try {
      const data = await api<FunResult>("/fun-ai", { body: { mode: "image" } });
      if (data?.image) {
        setImage(data.image);
      } else {
        toast.info(data?.text || "Obrázek se nepodařilo vygenerovat, zkus to znovu!");
      }
    } catch (e) {
      toast.error(funError(e, "Nepodařilo se vygenerovat obrázek"));
    } finally {
      setLoadingImage(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <Helmet>
        <title>AI Zábava – generátor vtipů a obrázků | Tokeny</title>
        <meta name="description" content="Generuj české AI vtipy a unikátní obrázky pomocí Gemini. Zdarma, bez registrace." />
        <link rel="canonical" href="https://tokeny.martinpohl.cz/fun" />
        <meta property="og:title" content="AI Zábava – vtipy a obrázky generované AI" />
        <meta property="og:description" content="Generátor českých vtipů a obrázků poháněný Gemini." />
        <meta property="og:url" content="https://tokeny.martinpohl.cz/fun" />
      </Helmet>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/" aria-label="Zpět na úvod">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground glass" aria-label="Zpět na úvod">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-fill flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold">
              AI Zábava 🎉
            </h1>
          </div>
        </div>

        {/* Joke Section */}
        <Card className="glass animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">😂</span>
              <h2 className="text-lg font-semibold tabular-nums">Generátor vtipů</h2>
            </div>

            {joke && (
              <div className="glass rounded-xl p-4 animate-fade-in">
                <p className="text-foreground tabular-nums text-sm leading-relaxed whitespace-pre-wrap">
                  {joke}
                </p>
              </div>
            )}

            <Button
              onClick={generateJoke}
              disabled={loadingJoke}
              className="gap-2 tabular-nums hover:opacity-90 border-0"
            >
              {loadingJoke ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Laugh className="h-4 w-4" />
              )}
              {loadingJoke ? "Přemýšlím... 🧠" : "Dej vtip! 🎲"}
            </Button>
          </CardContent>
        </Card>

        {/* Image Section */}
        <Card className="glass animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎨</span>
              <h2 className="text-lg font-semibold tabular-nums">Generátor obrázků</h2>
            </div>

            {loadingImage && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground tabular-nums text-sm">
                    Maluji masterpiece... 🖌️
                  </p>
                </div>
              </div>
            )}

            {image && !loadingImage && (
              <div className="rounded-xl overflow-hidden gradient-border animate-fade-in">
                <img
                  src={image}
                  alt="AI vygenerovaný obrázek"
                  className="w-full h-auto"
                />
              </div>
            )}

            <Button
              onClick={generateImage}
              disabled={loadingImage}
              variant="outline"
              className="gap-2 tabular-nums glass glass-hover border-accent/30 text-primary"
            >
              {loadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Image className="h-4 w-4" />
              )}
              {loadingImage ? "Kreslím... ✏️" : "Generuj obrázek! 🖼️"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground tabular-nums text-xs animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
          ✨ Poháněno AI • Každý výsledek je unikátní ✨
        </p>
      </div>
    </main>
  );
}
