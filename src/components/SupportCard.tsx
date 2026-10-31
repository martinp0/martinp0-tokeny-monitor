import { Capacitor } from "@capacitor/core";
import { Coffee, ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { csCopy } from "@/lib/cs-typography";

const SUPPORT_URL = "https://buymeacoffee.com/martinpohlp";

type Props = {
  /** Where the card sits; becomes utm_medium. */
  placement: "landing" | "calculator";
  className?: string;
};

/**
 * Quiet "support the project" card for the public web.
 * Hidden inside the native (Capacitor) app: App Store guideline 3.1.1 forbids
 * external tip/donation links in iOS apps. No popups, no counters, no urgency.
 */
export default function SupportCard({ placement, className = "" }: Props) {
  const { t } = useTranslation();
  if (Capacitor.isNativePlatform()) return null;

  const href = `${SUPPORT_URL}?utm_source=tokeny.martinpohl.cz&utm_medium=${placement}&utm_campaign=support_card`;

  return (
    <aside
      aria-labelledby={`support-${placement}`}
      data-testid="support-card"
      className={`mx-auto w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-sm md:p-6 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
            <Coffee className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p id={`support-${placement}`} className="font-display font-semibold text-foreground">
              {csCopy(t("support.title"))} <span className="gradient-text">{csCopy(t("support.titleHighlight"))}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{csCopy(t("support.desc"))}</p>
          </div>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 self-start rounded-full border border-primary/30 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:self-center"
        >
          {csCopy(t("support.button"))} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
