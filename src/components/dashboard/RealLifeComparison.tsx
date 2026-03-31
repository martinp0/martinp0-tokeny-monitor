import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

interface RealLifeItem {
  emoji: string;
  name: string;
  priceCzk: number;
}

const DEFAULT_ITEMS: RealLifeItem[] = [
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

const STORAGE_KEY = "reallife-custom-items";

function loadCustomItems(): RealLifeItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

interface Props {
  totalCostCzk: number;
}

export function RealLifeComparison({ totalCostCzk }: Props) {
  const [customItems, setCustomItems] = useState<RealLifeItem[]>(loadCustomItems);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newEmoji, setNewEmoji] = useState("🛍️");

  const allItems = useMemo(() => [...DEFAULT_ITEMS, ...customItems], [customItems]);

  const comparisons = useMemo(() => {
    if (totalCostCzk <= 0) return [];
    return allItems
      .map((item) => ({
        ...item,
        isCustom: customItems.some((c) => c.name === item.name),
        count: totalCostCzk / item.priceCzk,
      }))
      .sort((a, b) => a.count - b.count);
  }, [totalCostCzk, allItems, customItems]);

  const saveCustomItems = (items: RealLifeItem[]) => {
    setCustomItems(items);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  };

  const handleAdd = () => {
    const trimmedName = newName.trim().slice(0, 50);
    const price = parseFloat(newPrice);
    if (!trimmedName || isNaN(price) || price <= 0 || price > 1_000_000) return;
    if (allItems.some((i) => i.name === trimmedName)) return;

    const item: RealLifeItem = { emoji: newEmoji || "🛍️", name: trimmedName, priceCzk: Math.round(price) };
    saveCustomItems([...customItems, item]);
    setNewName("");
    setNewPrice("");
    setNewEmoji("🛍️");
    setShowForm(false);
  };

  const handleRemove = (name: string) => {
    saveCustomItems(customItems.filter((i) => i.name !== name));
  };

  if (totalCostCzk <= 0) return null;

  return (
    <Card className="bg-card border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground font-mono flex items-center gap-2">
            <span>🛒</span> Za tvoje AI tokeny bys koupil/a:
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-mono gap-1"
            onClick={() => setShowForm(!showForm)}
          >
            <Plus className="h-3 w-3" />
            Přidat
          </Button>
        </div>

        {showForm && (
          <div className="flex flex-wrap gap-2 mb-3 animate-fade-in">
            <Input
              placeholder="Emoji"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value.slice(0, 2))}
              className="w-16 h-8 text-center bg-secondary border-border font-mono text-sm"
            />
            <Input
              placeholder="Název položky"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={50}
              className="flex-1 min-w-[120px] h-8 bg-secondary border-border font-mono text-sm"
            />
            <Input
              type="number"
              placeholder="Cena (Kč)"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              min={1}
              max={1000000}
              className="w-24 h-8 bg-secondary border-border font-mono text-sm"
            />
            <Button size="sm" className="h-8 text-xs font-mono" onClick={handleAdd}>
              Přidat
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {comparisons.map((item, index) => (
            <div
              key={item.name}
              className={`relative bg-secondary/40 rounded-lg p-3 text-center border transition-all hover:scale-105 animate-fade-in opacity-0 ${
                item.isCustom
                  ? "border-primary/30 ring-1 ring-primary/10"
                  : "border-border/20 hover:border-primary/30"
              }`}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: "forwards" }}
            >
              {item.isCustom && (
                <button
                  onClick={() => handleRemove(item.name)}
                  className="absolute top-1 right-1 text-muted-foreground/50 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
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
