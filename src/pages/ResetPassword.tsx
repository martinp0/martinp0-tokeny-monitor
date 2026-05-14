import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Hesla se neshodují");
      return;
    }
    if (password.length < 6) {
      toast.error("Heslo musí mít alespoň 6 znaků");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Heslo bylo úspěšně změněno");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Chyba při změně hesla");
    } finally {
      setLoading(false);
    }
  };

  const head = (
    <Helmet>
      <title>Reset hesla – OpenRouter Monitor</title>
      <meta name="description" content="Nastavte si nové heslo k vašemu účtu OpenRouter Monitor." />
      <link rel="canonical" href="https://tokeny.pohl.uk/reset-password" />
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );

  if (!ready) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        {head}
        <Card className="w-full max-w-md bg-card border-border/50">
          <CardContent className="p-8 text-center">
            <h1 className="text-lg font-semibold text-foreground mb-2">Reset hesla</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Neplatný nebo expirovaný odkaz na reset hesla.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline" className="mt-4 font-mono">
              Zpět na přihlášení
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      {head}
      <Card className="w-full max-w-md bg-card border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">OpenRouter Monitor</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Nové heslo</h1>
          <CardTitle className="sr-only">Nové heslo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reset-password" className="sr-only">Nové heslo</Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="Nové heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary border-border font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset-password-confirm" className="sr-only">Potvrdit heslo</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                placeholder="Potvrdit heslo"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary border-border font-mono"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2 font-mono">
              <KeyRound className="h-4 w-4" />
              {loading ? "Načítání..." : "Nastavit nové heslo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
