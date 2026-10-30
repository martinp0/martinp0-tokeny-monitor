import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  /** Imports the file (OpenRouter CSV or Cursor / Grok Bot usage export) and reports progress 0..1. */
  onUpload: (file: File, onProgress: (fraction: number) => void) => Promise<unknown> | void;
}

export function CsvUpload({ onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Nahrajte prosím soubor ve formátu .csv");
      return;
    }
    setProgress(0);
    try {
      await onUpload(file, setProgress);
    } catch (err) {
      toast.error("Nahrávání selhalo");
      console.error(err);
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && progress === null) handleFile(file);
  }, [handleFile, progress]);

  const busy = progress !== null;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative ${dragging ? "ring-2 ring-primary rounded-lg" : ""}`}
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
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        aria-busy={busy}
        onClick={() => inputRef.current?.click()}
        className="gap-2 border-border hover:bg-secondary hover:text-foreground tabular-nums text-xs"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? `Importuji… ${Math.round((progress ?? 0) * 100)} %` : "Upload CSV"}
      </Button>
    </div>
  );
}
