import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ORDER = ["system", "light", "dark"] as const;
type Mode = (typeof ORDER)[number];

/** Cycles System → Light → Dark, like the appearance control in macOS. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current: Mode = mounted && ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;
  const label = t(`theme.${current}`);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      aria-label={`${t("theme.label")}: ${label}. ${t("theme.switchTo")} ${t(`theme.${next}`)}`}
      title={`${t("theme.label")}: ${label}`}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </Button>
  );
}
