import { useState, useEffect, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, User, Lock, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SharedDashboardsManager } from "@/components/dashboard/SharedDashboardsManager";

const Profile = () => {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [session]);

  async function updateProfile() {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", session.user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profil uložen");
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      toast.error("Heslo musí mít alespoň 6 znaků");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Hesla se neshodují");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Heslo změněno");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function exportData() {
    if (!session) return;
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("activity_rows")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info("Nemáš žádná data k exportu");
        setExporting(false);
        return;
      }

      const headers = Object.keys(data[0]);
      const csv = [
        headers.join(","),
        ...data.map((row) =>
          headers.map((h) => {
            const v = (row as any)[h];
            const str = v === null || v === undefined ? "" : String(v);
            return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
          }).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tokeny-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exportována");
    } catch (e: any) {
      toast.error(e.message || "Chyba při exportu");
    }
    setExporting(false);
  }

  async function deleteAccount() {
    if (!session) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Účet smazán");
      await signOut();
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Chyba při mazání účtu");
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background bg-mesh">
      <header className="border-b border-white/[0.06] px-6 py-3 glass">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět na dashboard
          </Link>
          <h1 className="text-lg font-bold gradient-text">Profil</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Display name */}
        <Card className="glass border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-accent" /> Základní údaje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input value={session?.user.email ?? ""} disabled className="mt-1 font-mono opacity-60" />
            </div>
            <div>
              <Label className="text-xs">Zobrazované jméno</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 font-mono"
                placeholder="Tvé jméno"
              />
            </div>
            <Button onClick={updateProfile} disabled={saving}>
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="glass border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" /> Změna hesla
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Nové heslo</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 font-mono"
                placeholder="Min. 6 znaků"
              />
            </div>
            <div>
              <Label className="text-xs">Potvrzení hesla</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 font-mono"
                placeholder="Znovu stejné heslo"
              />
            </div>
            <Button onClick={changePassword} disabled={saving}>
              Změnit heslo
            </Button>
          </CardContent>
        </Card>

        {/* Shared dashboards & OG image management */}
        <SharedDashboardsManager />

        {/* Export */}
        <Card className="glass border-white/[0.06]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-accent" /> Export dat (GDPR)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Stáhni si všechna svá data jako CSV soubor. Obsahuje kompletní historii activity rows.
            </p>
            <Button variant="outline" onClick={exportData} disabled={exporting} className="gap-2">
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exportuji…" : "Exportovat data"}
            </Button>
          </CardContent>
        </Card>

        {/* Delete account */}
        <Card className="glass border-white/[0.06] border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 className="h-4 w-4" /> Nebezpečná zóna
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Smazání účtu je nevratné. Všechna tvá data (activity rows, profil, budget alerty, MCP tokeny) budou trvale odstraněna.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={deleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Mažu…" : "Smazat účet"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass border-white/[0.08]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Opravdu smazat účet?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tato akce je nevratná. Všechna data budou trvale smazána a nebude možné je obnovit.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Zrušit</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteAccount} className="bg-destructive hover:bg-destructive/90">
                    Ano, smazat vše
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
