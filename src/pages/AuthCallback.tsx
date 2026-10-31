import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { readAuthError, sanitizeNext } from "@/lib/auth-redirect";

/**
 * Landing page after Google / Apple sign-in. Neon Auth redirects here with
 * `?neon_auth_session_verifier=…`; authClient.getSession() exchanges it (through our
 * /api/auth proxy) for the first-party session cookie.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = sanitizeNext(params.get("next"));
    const urlError = readAuthError(window.location.search, window.location.hash);
    if (urlError) {
      setError(urlError);
      return;
    }

    let cancelled = false;
    authClient.getSession(true).then((session) => {
      if (cancelled) return;
      if (session) navigate(next, { replace: true });
      else setError("Přihlášení se nepodařilo dokončit. Zkus to prosím znovu.");
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="min-h-screen bg-background bg-mesh flex items-center justify-center p-4">
      <Helmet>
        <title>Přihlašování… – Tokeny Monitor</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      {error ? (
        <div className="glass rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
          <h1 className="text-lg font-semibold">Přihlášení selhalo</h1>
          <p className="text-sm text-muted-foreground break-words">{error}</p>
          <Link to="/auth" className="text-primary underline text-sm">Zpět na přihlášení</Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Dokončuji přihlášení…
        </div>
      )}
    </main>
  );
}
