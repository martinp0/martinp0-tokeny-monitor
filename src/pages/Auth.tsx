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
        toast.success("Přihlášení úspěšné");
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
        toast.success("Registrace úspěšná!");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email s odkazem na reset hesla byl odeslán");
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">OpenRouter Monitor</span>
          </div>
          <CardTitle className="text-lg text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {view === "register" && (
              <Input
                type="text"
                placeholder="Jméno"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-secondary border-border font-mono"
              />
            )}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-secondary border-border font-mono"
            />
            {view !== "forgot" && (
              <Input
                type="password"
                placeholder="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary border-border font-mono"
              />
            )}
            <Button type="submit" disabled={loading} className="w-full gap-2 font-mono">
              {view === "login" && <LogIn className="h-4 w-4" />}
              {view === "register" && <UserPlus className="h-4 w-4" />}
              {view === "forgot" && <Mail className="h-4 w-4" />}
              {loading
                ? "Načítání..."
                : view === "login"
                ? "Přihlásit se"
                : view === "register"
                ? "Zaregistrovat se"
                : "Odeslat reset email"}
            </Button>
          </form>
          {view !== "forgot" && (
            <div className="mt-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-mono">nebo</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 font-mono"
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
                Přihlásit se přes Apple
              </Button>
            </div>
          )}
          <div className="mt-4 text-center space-y-2">
            {view === "login" && (
              <>
                <button
                  onClick={() => setView("forgot")}
                  className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  Zapomenuté heslo?
                </button>
                <button
                  onClick={() => setView("register")}
                  className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                >
                  Nemáte účet? Zaregistrujte se
                </button>
              </>
            )}
            {view === "register" && (
              <button
                onClick={() => setView("login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
              >
                Máte účet? Přihlaste se
              </button>
            )}
            {view === "forgot" && (
              <button
                onClick={() => setView("login")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono flex items-center justify-center gap-1 w-full"
              >
                <ArrowLeft className="h-3 w-3" />
                Zpět na přihlášení
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
