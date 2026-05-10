import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface SubscriptionState {
  isPro: boolean;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "inactive";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  startCheckout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const { session } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [status, setStatus] = useState<SubscriptionState["status"]>("inactive");
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error || !data) throw error ?? new Error("No data");
      setIsPro(data.isPro);
      setStatus(data.status);
      setCurrentPeriodEnd(data.currentPeriodEnd);
      setCancelAtPeriodEnd(data.cancelAtPeriodEnd);
    } catch {
      // Fail silently — treat as free tier
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startCheckout = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("create-checkout");
    if (error || !data?.url) throw error ?? new Error("No checkout URL");
    window.location.href = data.url;
  }, []);

  return { isPro, status, currentPeriodEnd, cancelAtPeriodEnd, loading, startCheckout, refresh };
}
