import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { BillingInterval } from "@/config/pricing";

export interface SubscriptionStatus {
  isPro: boolean;
  status: string | null;
  interval: BillingInterval | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasCustomer: boolean;
}

const FREE: SubscriptionStatus = {
  isPro: false,
  status: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasCustomer: false,
};

async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { data, error } = await supabase.functions.invoke("check-subscription");
  if (error) throw error;
  return { ...FREE, ...(data as Partial<SubscriptionStatus>) };
}

async function errorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (!ctx || typeof (ctx as Response).clone !== "function") return null;
  try {
    return (await (ctx as Response).clone().json())?.error ?? null;
  } catch {
    return null;
  }
}

async function openPortal(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-portal-session", { body: {} });
  if (error || !(data as { url?: string })?.url) {
    toast.error(i18n.t("pricing.portalError"));
    return;
  }
  window.location.href = (data as { url: string }).url;
}

async function startCheckout(interval: BillingInterval = "month"): Promise<void> {
  const { data, error } = await supabase.functions.invoke("create-checkout", { body: { interval } });
  if (error) {
    // Already subscribed (e.g. second tab) → manage the existing subscription instead.
    if ((await errorCode(error)) === "already_pro") return openPortal();
    toast.error(i18n.t("pricing.checkoutError"));
    return;
  }
  const url = (data as { url?: string })?.url;
  if (!url) {
    toast.error(i18n.t("pricing.checkoutError"));
    return;
  }
  window.location.href = url;
}

/** Plan of the signed-in user. Server-side checks are authoritative; this only drives the UI. */
export function useSubscription() {
  const queryClient = useQueryClient();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id ?? null;
  const { data, isLoading } = useQuery({
    queryKey: ["subscription", userId],
    queryFn: fetchSubscriptionStatus,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["subscription"] });
  }

  const s = data ?? FREE;
  return {
    ...s,
    loading: authLoading || (!!userId && isLoading),
    startCheckout,
    openPortal,
    refresh,
  };
}
