import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ size = "sm", className }: { size?: "sm" | "default"; className?: string }) {
  const { i18n, t } = useTranslation();

  const toggle = () => {
    const next = i18n.language?.startsWith("cs") ? "en" : "cs";
    i18n.changeLanguage(next);
  };

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={toggle}
      className={cn("gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground", className)}
      title="Switch language"
    >
      <Globe className="h-3.5 w-3.5" />
      {t("lang.switch")}
    </Button>
  );
}
