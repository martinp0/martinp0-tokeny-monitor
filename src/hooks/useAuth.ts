import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};

    import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        if (cancelled) return;
        const { data } = supabase.auth.onAuthStateChange((_event, next) => {
          if (cancelled) return;
          setSession(next);
          setLoading(false);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        return supabase.auth.getSession().then(({ data: { session: next } }) => {
          if (cancelled) return;
          setSession(next);
          setLoading(false);
        });
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
  };

  return { session, loading, signOut };
}
