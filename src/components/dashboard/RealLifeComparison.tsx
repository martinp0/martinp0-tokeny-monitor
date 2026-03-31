import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface RealLifeItem {
  emoji: string;
  name: string;
  priceCzk: number;
}

const ITEMS: RealLifeItem[] = [
  { emoji: "☕", name: "Espresso", priceCzk: 55 },
  { emoji: "🥐", name: "Croissant", priceCzk: 45 },
  { emoji: "🍺", name: "Pivo (0,5l)", priceCzk: 49 },
  { emoji: "🍕", name: "Pizza Margherita", priceCzk: 169 },
  { emoji: "🌭", name: "Párek v rohlíku", priceCzk: 35 },
  { emoji: "🎬", name: "Lístek do kina", priceCzk: 229 },
  { emoji: "🚇", name: "Jízdenka MHD (90 min)", priceCzk: 40 },
  { emoji: "📱", name: "Nabití telefonu", priceCzk: 2 },
  { emoji: "🍫", name: "Čokoláda Milka", priceCzk: 39 },
  { emoji: "🥖", name: "Chleba", priceCzk: 32 },
  { emoji: "🧋", name: "Bubble tea", priceCzk: 119 },
  { emoji: "⛽", name: "Litr benzínu", priceCzk: 37 },
  { emoji: "💇", name: "Střih u holiče", priceCzk: 350 },
  { emoji: "🎮", name: "Hodina v herně", priceCzk: 150 },
  { emoji: "🏊", name: "Vstup do bazénu", priceCzk: 120 },
];

interface Props {
  totalCostCzk: number;
}

export function RealLifeComparison({ totalCostCzk }: Props) {
  const comparisons = useMemo(() => {
    if (totalCostCzk <= 0) return [];
    return ITEMS
      .map((item) => ({
        ...item,
        count: totalCostCzk / item.priceCzk,
      }))
      .sort((a, b) => a.count - b.count);
  }, [totalCostCzk]);

  if (totalCostCzk <= 0) return null;

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground font-mono mb-3 flex items-center gap-2">
          <span>🛒</span> Za tvoje AI tokeny bys koupil/a:
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {comparisons.map((item, index) => (
            <div
              key={item.name}
              className="bg-secondary/40 rounded-lg p-3 text-center border border-border/20 hover:border-primary/30 transition-all hover:scale-105 animate-fade-in opacity-0"
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: "forwards" }}
            >
              <div className="text-2xl mb-1">{item.emoji}</div>
              <div className="text-primary font-mono text-sm font-bold">
                {item.count >= 10
                  ? Math.floor(item.count).toLocaleString("cs-CZ")
                  : item.count.toLocaleString("cs-CZ", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                ×
              </div>
              <div className="text-muted-foreground text-xs font-mono mt-0.5 leading-tight">
                {item.name}
              </div>
              <div className="text-muted-foreground/50 text-[10px] font-mono">
                {item.priceCzk} Kč
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
