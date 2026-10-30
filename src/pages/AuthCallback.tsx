import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { readAuthError, sanitizeNext } from "@/lib/auth-redirect";

/**
 * Landing page for OAuth (Google / Apple) and email-confirmation redirects.
 *
 * supabase-js (detectSessionInUrl) consumes the tokens from the URL fragment (implicit flow) or
 * exchanges `?code=` (PKCE) during client initialisation; getSession() resolves after that.
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

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigate(next, { replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        done = true;
        navigate("/reset-password", { replace: true });
      } else if (session) {
        finish();
      }
    });

    (async () => {
      let { data, error } = await supabase.auth.getSession();
      // PKCE: exchange the code explicitly if the client did not do it already.
      const code = params.get("code");
      if (!data.session && !error && code) {
        const res = await supabase.auth.exchangeCodeForSession(code);
        error = res.error;
        data = { session: res.data.session };
      }
      if (error) setError(error.message);
      else if (data.session) finish();
      else {
        // Give the auth listener a moment (slow token processing), then fail visibly.
        setTimeout(() => {
          if (!done) setError("Přihlášení se nepodařilo dokončit. Zkus to prosím znovu.");
        }, 8000);
      }
    })();

    return () => sub.subscription.unsubscribe();
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
