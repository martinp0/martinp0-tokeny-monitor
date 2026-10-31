import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, KeyRound } from "lucide-react";
import { toast } from "sonner";

/** Password reset with the 6-digit code Neon Auth e-mails (requested on /auth → "Zapomněl/a jsi heslo?"). */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Hesla se neshodují");
      return;
    }
    if (password.length < 8) {
      toast.error("Heslo musí mít alespoň 8 znaků");
      return;
    }
    setLoading(true);
    try {
      await authClient.resetPassword(email.trim(), code.trim(), password);
      toast.success("Heslo bylo změněno, přihlas se novým heslem");
      navigate("/auth");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email.trim()) return toast.error("Zadej e-mail");
    try {
      await authClient.requestPasswordReset(email.trim());
      toast.success("Nový kód je na cestě 📬");
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Helmet>
        <title>Reset hesla – Tokeny</title>
        <meta name="description" content="Nastavte si nové heslo k vašemu účtu Tokeny." />
        <link rel="canonical" href="https://tokeny.martinpohl.cz/reset-password" />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <Card className="w-full max-w-md glass border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Tokeny</span>
          </div>
          <h1 className="text-lg font-semibold text-foreground">Nové heslo</h1>
          <CardTitle className="sr-only">Nové heslo</CardTitle>
          <p className="text-sm text-muted-foreground">Zadej kód, který ti přišel e-mailem, a nové heslo.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="reset-email" className="sr-only">E-mail</Label>
              <Input id="reset-email" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-muted/60 border-border tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset-code" className="sr-only">Kód z e-mailu</Label>
              <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" placeholder="Kód z e-mailu" value={code} onChange={(e) => setCode(e.target.value)} required className="bg-muted/60 border-border tabular-nums tracking-widest" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset-password" className="sr-only">Nové heslo</Label>
              <Input id="reset-password" type="password" autoComplete="new-password" placeholder="Nové heslo" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="bg-muted/60 border-border tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset-password-confirm" className="sr-only">Potvrdit heslo</Label>
              <Input id="reset-password-confirm" type="password" autoComplete="new-password" placeholder="Potvrdit heslo" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} className="bg-muted/60 border-border tabular-nums" />
            </div>
            <Button type="submit" disabled={loading} className="w-full gap-2 tabular-nums">
              <KeyRound className="h-4 w-4" />
              {loading ? "Načítání..." : "Nastavit nové heslo"}
            </Button>
            <button type="button" onClick={resend} className="block w-full text-sm text-muted-foreground hover:text-foreground transition-colors">
              Poslat kód znovu
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
