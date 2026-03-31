import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogIn, UserPlus, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type View = "login" | "register" | "forgot";

export default function Auth() {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (view === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Přihlášení úspěšné ✨");
      } else if (view === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Registrace úspěšná! 🎉");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email s odkazem na reset hesla byl odeslán 📧");
        setView("login");
      }
    } catch (error: any) {
      toast.error(error.message || "Došlo k chybě");
    } finally {
      setLoading(false);
    }
  };

  const title = view === "login" ? "Přihlášení" : view === "register" ? "Registrace" : "Reset hesla";

  return (
    <div className="min-h-screen bg-background bg-mesh flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass border-white/[0.08] glow-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">OpenRouter Monitor</span>
          </div>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "register" && (
              <Input
                type="text"
                placeholder="Tvoje jméno ✏️"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] font-mono focus:border-primary/50"
              />
            )}
            <Input
              type="email"
              placeholder="Email 📧"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/[0.04] border-white/[0.08] font-mono focus:border-primary/50"
            />
            {view !== "forgot" && (
              <Input
                type="password"
                placeholder="Heslo 🔒"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-white/[0.04] border-white/[0.08] font-mono focus:border-primary/50"
              />
            )}
            <Button type="submit" disabled={loading} className="w-full gap-2 font-mono bg-gradient-to-r from-primary to-[hsl(320,90%,65%)] hover:opacity-90 transition-opacity border-0">
              {view === "login" && <LogIn className="h-4 w-4" />}
              {view === "register" && <UserPlus className="h-4 w-4" />}
              {view === "forgot" && <Mail className="h-4 w-4" />}
              {loading
                ? "Moment... ⏳"
                : view === "login"
                ? "Let's go! 🚀"
                : view === "register"
                ? "Zaregistrovat se ✨"
                : "Odeslat reset email 📬"}
            </Button>
          </form>

          {view !== "forgot" && (
            <div className="mt-5">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/[0.08]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-mono">nebo</span>
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 font-mono glass glass-hover border-white/[0.08]"
                  onClick={async () => {
                    const { error } = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (error) toast.error(error.message || "Chyba při přihlášení přes Google");
                  }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Pokračovat přes Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 font-mono glass glass-hover border-white/[0.08]"
                  onClick={async () => {
                    const { error } = await lovable.auth.signInWithOAuth("apple", {
                      redirect_uri: window.location.origin,
                    });
                    if (error) toast.error(error.message || "Chyba při přihlášení přes Apple");
                  }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Pokračovat přes Apple
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 text-center space-y-2">
            {view === "login" && (
              <>
                <button
                  onClick={() => setView("forgot")}
                  className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  Zapomněl/a jsi heslo? 🤔
                </button>
                <button
                  onClick={() => setView("register")}
                  className="block w-full text-sm text-muted-foreground hover:text-primary transition-colors font-mono"
                >
                  Nemáš účet? Vytvoř si ho! ✨
                </button>
              </>
            )}
            {view === "register" && (
              <button
                onClick={() => setView("login")}
                className="text-sm text-muted-foreground hover:text-primary transition-colors font-mono"
              >
                Už máš účet? Přihlas se 👋
              </button>
            )}
            {view === "forgot" && (
              <button
                onClick={() => setView("login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono flex items-center justify-center gap-1 w-full"
              >
                <ArrowLeft className="h-3 w-3" />
                Zpátky na login
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
