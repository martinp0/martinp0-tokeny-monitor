import { useState, useEffect, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { api } from "@/lib/api";
import { authClient, authErrorMessage } from "@/lib/auth-client";
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
import { fetchAllPages } from "@/lib/paginate";
import { SharedDashboardsManager } from "@/components/dashboard/SharedDashboardsManager";

const Profile = () => {
  const { session, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!session) return;
    api<{ profile: { display_name: string | null } | null }>("/me")
      .then(({ profile }) => {
        if (profile?.display_name) setDisplayName(profile.display_name);
      })
      .catch(() => {});
  }, [session]);

  async function updateProfile() {
    if (!session) return;
    setSaving(true);
    try {
      await api("/profile", { method: "PATCH", body: { display_name: displayName } });
      toast.success("Profil uložen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) {
      toast.error("Heslo musí mít alespoň 8 znaků");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Hesla se neshodují");
      return;
    }
    setSaving(true);
    try {
      await authClient.changePassword(currentPassword, newPassword);
      toast.success("Heslo změněno");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    if (!session) return;
    setExporting(true);
    try {
      // Paged: the API returns at most 5000 rows per request; a GDPR export must be complete.
      const { rows: data } = await fetchAllPages<Record<string, unknown>>(
        (from, to) =>
          api<{ rows: Record<string, unknown>[] }>(`/activity?offset=${from}&limit=${to - from + 1}`).then(
            (r) => ({ data: r.rows, error: null }),
            (e: Error) => ({ data: null, error: { message: e.message } }),
          ),
        { pageSize: 5000, maxRows: 10_000_000 },
      );
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
      await api("/account/delete", { body: {} });
      toast.success("Účet smazán");
      await signOut();
      navigate("/");
    } catch (e: any) {
      toast.error(e.message || "Chyba při mazání účtu");
      setDeleting(false);
    }
  }

  const emailId = useId();
  const nameId = useId();
  const currentPwdId = useId();
  const newPwdId = useId();
  const confirmPwdId = useId();

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Profil – účet, heslo a export dat | Tokeny</title>
        <meta name="description" content="Spravuj svůj profil, změň si heslo, exportuj data nebo smaž účet (GDPR)." />
        <link rel="canonical" href="https://tokeny.martinpohl.cz/profile" />
        <meta name="robots" content="noindex,nofollow" />
        <meta property="og:title" content="Profil – Tokeny" />
        <meta property="og:description" content="Spravuj svůj účet, heslo a export dat v Tokenech." />
        <meta property="og:url" content="https://tokeny.martinpohl.cz/profile" />
      </Helmet>
      <header className="sticky top-0 z-40 glass-bar pt-safe px-4 sm:px-6 py-2">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm tabular-nums text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět na dashboard
          </Link>
          <h1 className="text-lg font-bold">Profil</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Display name */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-primary" /> Základní údaje
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={emailId} className="text-xs">E-mail</Label>
              <Input id={emailId} value={session?.user.email ?? ""} disabled className="mt-1 tabular-nums opacity-60" />
            </div>
            <div>
              <Label htmlFor={nameId} className="text-xs">Zobrazované jméno</Label>
              <Input
                id={nameId}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 tabular-nums"
                placeholder="Tvé jméno"
              />
            </div>
            <Button onClick={updateProfile} disabled={saving}>
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" /> Změna hesla
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={currentPwdId} className="text-xs">Současné heslo</Label>
              <Input
                id={currentPwdId}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 tabular-nums"
                placeholder="Tvé současné heslo"
              />
            </div>
            <div>
              <Label htmlFor={newPwdId} className="text-xs">Nové heslo</Label>
              <Input
                id={newPwdId}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 tabular-nums"
                placeholder="Min. 8 znaků"
              />
            </div>
            <div>
              <Label htmlFor={confirmPwdId} className="text-xs">Potvrzení hesla</Label>
              <Input
                id={confirmPwdId}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 tabular-nums"
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
        <Card className="glass border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-primary" /> Export dat (GDPR)
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
        <Card className="glass border-border border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <Trash2 className="h-4 w-4" /> Nebezpečná zóna
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Smazání účtu je nevratné. Všechna tvá data (activity rows, profil, budget alerty, MCP tokeny) budou trvale odstraněna a případné předplatné Pro se okamžitě ukončí.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={deleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Mažu…" : "Smazat účet"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Opravdu smazat účet?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tato akce je nevratná. Všechna data budou trvale smazána a nebude možné je obnovit. Předplatné Pro se ukončí hned, bez vrácení peněz za zbytek období.
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
