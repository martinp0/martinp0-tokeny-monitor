import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, X, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentAction {
  name: "apply_filters" | "set_currency" | "export_data";
  args: any;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  onAction: (a: AgentAction) => void;
}

const SUGGESTIONS = [
  "Kolik jsem utratil tento týden?",
  "Top 5 nejdražších modelů",
  "Najdi anomálie ve výdajích",
  "Filtruj jen Anthropic",
];

export function AiAgentChat({ onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Ahoj! Jsem tvůj AI asistent. Zeptej se mě na cokoliv o tvých datech, nebo mě nech ovládat dashboard. ✨" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-agent", {
        body: { messages: newMsgs.map((m) => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply || "(prázdná odpověď)" }]);

      for (const a of (data.ui_actions ?? []) as AgentAction[]) {
        onAction(a);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Chyba AI agenta");
      setMessages((prev) => [...prev, { role: "assistant", content: "Hmm, něco se pokazilo. Zkus to znova." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg glow-md hover:scale-110 transition-transform flex items-center justify-center"
          aria-label="Otevřít AI asistenta"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl glass border border-white/10 shadow-2xl glow-md animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">AI Asistent</div>
                <div className="text-[10px] text-muted-foreground font-mono">Powered by Lovable AI</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${m.role === "user" ? "bg-secondary" : "bg-gradient-to-br from-primary/30 to-accent/30"}`}>
                  {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/50"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 items-center">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] font-mono px-2 py-1 rounded-full bg-secondary/50 hover:bg-secondary border border-white/[0.06] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t border-white/[0.06] flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Zeptej se na cokoliv..."
              disabled={loading}
              className="flex-1 bg-secondary/50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/50 placeholder:text-muted-foreground"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="h-9 w-9 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
