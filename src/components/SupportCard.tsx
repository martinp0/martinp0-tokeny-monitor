import { Coffee, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { csCopy } from "@/lib/cs-typography";
import { isNativeAppSurface, supportHref } from "@/lib/support";

type Props = {
  /** Where the card sits; becomes utm_medium. */
  placement: "landing" | "calculator";
  className?: string;
};

/**
 * Quiet support card for the public website, above the footer.
 * Hidden in the native app and in a webview. App Store guideline 3.1.1
 * forbids external tip links on iOS. No popups, counters, or urgency.
 */
export default function SupportCard({ placement, className = "" }: Props) {
  const { t } = useTranslation();
  if (isNativeAppSurface()) return null;

  return (
    <aside
      aria-labelledby={`support-${placement}`}
      data-testid="support-card"
      className={`surface mx-auto w-full max-w-3xl rounded-3xl p-6 md:p-8${className ? ` ${className}` : ""}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden="true">
            <Coffee className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p id={`support-${placement}`} className="text-[17px] font-semibold text-foreground">
              {csCopy(t("support.title"))} {csCopy(t("support.titleHighlight"))}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{csCopy(t("support.desc"))}</p>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0 self-start sm:self-center">
          <a href={supportHref(placement)} target="_blank" rel="noopener noreferrer">
            {csCopy(t("support.button"))}
            <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </aside>
  );
}
