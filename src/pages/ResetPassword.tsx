import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
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
    } catch {
      toast.error("Heslo se nepodařilo změnit. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  const head = (
    <Helmet>
      <title>Obnovení hesla – OpenRouter Monitor</title>
      <meta name="description" content="Nastavte si nové heslo k vašemu účtu OpenRouter Monitor." />
      <link rel="canonical" href="https://tokeny.martinpohl.cz/reset-password" />
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );

  if (!ready) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {head}
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-8 text-center">
            <h1 className="text-lg font-semibold text-foreground mb-2">Obnovení hesla</h1>
            <p className="text-muted-foreground text-sm">
              Odkaz pro obnovení hesla je neplatný nebo vypršel.
            </p>
            <Button onClick={() => navigate("/auth")} variant="outline" className="mt-4 min-h-11">
              Zpět na přihlášení
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {head}
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">OpenRouter Monitor</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Nové heslo</h1>
          <CardTitle className="sr-only">Nové heslo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-password" className="sr-only">Nové heslo</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                placeholder="Nové heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password-confirm" className="sr-only">Potvrdit heslo</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Potvrdit heslo"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 bg-background"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full min-h-11">
              {loading ? "Odesílání…" : "Nastavit nové heslo"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
