import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Sparkles, Bug, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChangelogEntry {
  version: string;
  date: string;
  items: { type: "feature" | "fix" | "improvement"; text: string }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.5.0",
    date: "2026-05-07",
    items: [
      { type: "feature", text: "Changelog modal — vždy víš, co je nového" },
      { type: "feature", text: "User profil — změna hesla, export dat, smazání účtu" },
      { type: "feature", text: "Sdílené dashboardy — veřejné read-only linky" },
      { type: "feature", text: "i18n — přepínání mezi CZ a EN" },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-05-03",
    items: [
      { type: "feature", text: "Open-source — veřejné GitHub repo, Docker, self-host" },
      { type: "feature", text: "Buy Me a Coffee podpora" },
      { type: "improvement", text: "FAQ sekce na landing page" },
      { type: "fix", text: "Bezpečnostní opravy RLS politik" },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-28",
    items: [
      { type: "feature", text: "Brandované auth e-mail šablony" },
      { type: "feature", text: "MCP server pro Claude Desktop / Cursor" },
      { type: "feature", text: "AI agent s tool-calling" },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-04-20",
    items: [
      { type: "feature", text: "Real-life srovnání — kávy, piva, pizzy" },
      { type: "feature", text: "Anomaly detection panel" },
      { type: "feature", text: "Cost forecast" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-04-12",
    items: [
      { type: "feature", text: "CZK ↔ USD přepínání s kurzem ČNB" },
      { type: "feature", text: "Budget alerty" },
      { type: "improvement", text: "Vylepšené grafy a KPI karty" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-01",
    items: [
      { type: "feature", text: "CSV import z OpenRouteru" },
      { type: "feature", text: "Dashboard s grafy a tabulkou" },
      { type: "feature", text: "Autentizace (Email, Google, Apple)" },
    ],
  },
];

const LATEST_VERSION = CHANGELOG[0].version;
const LS_KEY = "tokeny_last_seen_version";

const typeIcon = {
  feature: <Sparkles className="h-3 w-3 text-accent" />,
  fix: <Bug className="h-3 w-3 text-destructive" />,
  improvement: <Zap className="h-3 w-3 text-primary" />,
};

const typeLabel = {
  feature: "Nové",
  fix: "Oprava",
  improvement: "Vylepšení",
};

export function ChangelogModal() {
  const [hasNew, setHasNew] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(LS_KEY);
    if (seen !== LATEST_VERSION) {
      setHasNew(true);
    }
  }, []);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      localStorage.setItem(LS_KEY, LATEST_VERSION);
      setHasNew(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-1.5 text-muted-foreground hover:text-foreground font-mono text-xs"
          title="Co je nového"
        >
          <Megaphone className="h-3.5 w-3.5" />
          {hasNew && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="glass border-white/[0.08] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 gradient-text">
            <Megaphone className="h-5 w-5" />
            Co je nového
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-6">
            {CHANGELOG.map((entry) => (
              <div key={entry.version}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                    v{entry.version}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(entry.date).toLocaleDateString("cs-CZ")}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 shrink-0">{typeIcon[item.type]}</span>
                      <span>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground mr-1.5">
                          {typeLabel[item.type]}
                        </span>
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
