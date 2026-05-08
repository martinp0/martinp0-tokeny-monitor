import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, BarChart3, Sparkles, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface Props {
  onUpload: (text: string, name: string) => Promise<void> | void;
}

export function OnboardingEmptyState({ onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Nahrajte prosím soubor ve formátu .csv");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          await onUpload(text, file.name);
          toast.success("Data úspěšně nahrána!");
        } catch (err) {
          toast.error("Nahrávání selhalo");
          console.error(err);
        }
      }
      setUploading(false);
    };
    reader.onerror = () => {
      toast.error("Soubor se nepodařilo přečíst");
      setUploading(false);
    };
    reader.readAsText(file);
  }, [onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
          <Sparkles className="h-3 w-3" />
          Vítejte v OpenRouter Monitoru
        </div>
        <h2 className="text-3xl md:text-4xl font-bold gradient-text tracking-tight">
          Nahrajte první CSV a začněte
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Pro zobrazení dashboardu potřebujeme váš export z OpenRouteru. Stačí pár kliknutí.
        </p>
      </div>

      {/* Drop zone */}
      <Card
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative p-10 border-2 border-dashed transition-all glass ${
          dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="flex flex-col items-center text-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Upload className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="text-lg font-semibold">Přetáhněte CSV sem</p>
            <p className="text-sm text-muted-foreground mt-1">nebo klikněte níže pro výběr souboru</p>
          </div>
          <Button
            size="lg"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2 font-mono"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {uploading ? "Nahrávám…" : "Vybrat CSV soubor"}
          </Button>
        </div>
      </Card>

      {/* Steps */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 glass">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold font-mono">1</div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Otevřete OpenRouter</h3>
              <p className="text-xs text-muted-foreground">Přihlaste se a jděte do sekce Activity.</p>
              <a
                href="https://openrouter.ai/activity"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono"
              >
                openrouter.ai/activity <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Card>

        <Card className="p-5 glass">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold font-mono">2</div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Stáhněte CSV export</h3>
              <p className="text-xs text-muted-foreground">Klikněte na tlačítko „Export CSV“ a uložte soubor do počítače.</p>
            </div>
          </div>
        </Card>

        <Card className="p-5 glass">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold font-mono">3</div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Nahrajte soubor</h3>
              <p className="text-xs text-muted-foreground">Přetáhněte CSV výše. Dashboard se automaticky vygeneruje.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* What you get */}
      <div className="mt-8">
        <p className="text-xs font-mono text-muted-foreground text-center mb-4 uppercase tracking-wider">
          Co získáte po nahrání
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: BarChart3, label: "Náklady v čase" },
            { icon: CheckCircle2, label: "Top modely & poskytovatelé" },
            { icon: Sparkles, label: "AI agent & predikce" },
            { icon: FileSpreadsheet, label: "Export do PDF/PNG" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border/40">
              <item.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-center text-muted-foreground mt-8 font-mono">
        Vaše data zůstávají soukromá – jsou uložena ve vašem účtu a chráněna RLS politikami.
      </p>
    </div>
  );
}
