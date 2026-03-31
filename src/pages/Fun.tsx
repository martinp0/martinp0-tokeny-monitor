import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Laugh, Image, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Fun() {
  const [joke, setJoke] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loadingJoke, setLoadingJoke] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  const generateJoke = async () => {
    setLoadingJoke(true);
    try {
      const { data, error } = await supabase.functions.invoke("fun-ai", {
        body: { mode: "joke" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setJoke(data.joke);
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se vygenerovat vtip");
    } finally {
      setLoadingJoke(false);
    }
  };

  const generateImage = async () => {
    setLoadingImage(true);
    setImage(null);
    try {
      const { data, error } = await supabase.functions.invoke("fun-ai", {
        body: { mode: "image" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.image) {
        setImage(data.image);
      } else {
        toast.info(data?.text || "Obrázek se nepodařilo vygenerovat, zkus to znovu!");
      }
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se vygenerovat obrázek");
    } finally {
      setLoadingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-mesh p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground glass">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">
              AI Zábava 🎉
            </h1>
          </div>
        </div>

        {/* Joke Section */}
        <Card className="glass glow-sm animate-fade-in" style={{ animationDelay: "100ms", animationFillMode: "forwards" }}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">😂</span>
              <h2 className="text-lg font-semibold font-mono gradient-text">Generátor vtipů</h2>
            </div>

            {joke && (
              <div className="glass rounded-xl p-4 animate-fade-in">
                <p className="text-foreground font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {joke}
                </p>
              </div>
            )}

            <Button
              onClick={generateJoke}
              disabled={loadingJoke}
              className="gap-2 font-mono bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] hover:opacity-90 border-0"
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
        <Card className="glass glow-sm animate-fade-in" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🎨</span>
              <h2 className="text-lg font-semibold font-mono gradient-text">Generátor obrázků</h2>
            </div>

            {loadingImage && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground font-mono text-sm">
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
              className="gap-2 font-mono glass glass-hover border-accent/30 text-accent"
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

        <p className="text-center text-muted-foreground font-mono text-xs animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "forwards" }}>
          ✨ Poháněno AI • Každý výsledek je unikátní ✨
        </p>
      </div>
    </div>
  );
}
