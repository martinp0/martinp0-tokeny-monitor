import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className }: ProBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest",
        "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-violet-300",
        className,
      )}
    >
      <Sparkles className="h-2.5 w-2.5" />
      Pro
    </span>
  );
}
