import { useEffect, useState } from "react";
import { authClient, type AuthSession } from "@/lib/auth-client";

export type Session = AuthSession;

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const off = authClient.onChange((s) => {
      if (!cancelled) {
        setSession(s);
        setLoading(false);
      }
    });
    authClient.getSession().then((s) => {
      if (cancelled) return;
      setSession(s);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const signOut = () => authClient.signOut();

  return { session, loading, signOut };
}
