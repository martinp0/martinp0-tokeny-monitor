import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Přihlášení úspěšné");
      } else {
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
      }
    } catch (error: any) {
      toast.error(error.message || "Chyba při přihlášení");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">OpenRouter Monitor</span>
          </div>
          <CardTitle className="text-lg text-foreground">
            {isLogin ? "Přihlášení" : "Registrace"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
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
            <Input
              type="password"
              placeholder="Heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-secondary border-border font-mono"
            />
            <Button type="submit" disabled={loading} className="w-full gap-2 font-mono">
              {isLogin ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {loading ? "Načítání..." : isLogin ? "Přihlásit se" : "Zaregistrovat se"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              {isLogin ? "Nemáte účet? Zaregistrujte se" : "Máte účet? Přihlaste se"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
