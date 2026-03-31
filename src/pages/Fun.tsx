import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Laugh, Image, Loader2, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground font-mono">
              AI Zábava 🎉
            </h1>
          </div>
        </div>

        {/* Joke Section */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Laugh className="h-5 w-5" />
              <h2 className="text-lg font-semibold font-mono">Generátor vtipů</h2>
            </div>

            {joke && (
              <div className="bg-secondary/50 rounded-lg p-4 border border-border/30">
                <p className="text-foreground font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {joke}
                </p>
              </div>
            )}

            <Button
              onClick={generateJoke}
              disabled={loadingJoke}
              className="gap-2 font-mono"
            >
              {loadingJoke ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Laugh className="h-4 w-4" />
              )}
              {loadingJoke ? "Přemýšlím..." : "Vygeneruj vtip 😂"}
            </Button>
          </CardContent>
        </Card>

        {/* Image Section */}
        <Card className="bg-card border-border/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-accent">
              <Image className="h-5 w-5" />
              <h2 className="text-lg font-semibold font-mono">Generátor obrázků</h2>
            </div>

            {loadingImage && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground font-mono text-sm">
                    Maluji něco šíleného...
                  </p>
                </div>
              </div>
            )}

            {image && !loadingImage && (
              <div className="rounded-lg overflow-hidden border border-border/30">
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
              className="gap-2 font-mono border-accent/30 text-accent hover:bg-accent/10"
            >
              {loadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Image className="h-4 w-4" />
              )}
              {loadingImage ? "Kreslím..." : "Vygeneruj obrázek 🎨"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-muted-foreground font-mono text-xs">
          Poháněno AI • Každý výsledek je unikátní
        </p>
      </div>
    </div>
  );
}
