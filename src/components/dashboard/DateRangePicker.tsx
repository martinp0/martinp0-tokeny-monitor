import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRange {
  from: Date;
  to: Date;
}

interface Props {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 border-border hover:bg-secondary hover:text-foreground font-mono text-xs min-w-[200px] justify-start",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {value
              ? `${format(value.from, "yyyy-MM-dd")} → ${format(value.to, "yyyy-MM-dd")}`
              : "All dates"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={value ? { from: value.from, to: value.to } : undefined}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                onChange({ from: range.from, to: range.to });
              } else if (range?.from) {
                onChange({ from: range.from, to: range.from });
              }
            }}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
