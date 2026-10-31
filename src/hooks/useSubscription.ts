import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import i18n from "@/i18n";
import { api, ApiError } from "@/lib/api";
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
  const data = await api<Partial<SubscriptionStatus>>("/subscription");
  return { ...FREE, ...data };
}

async function openPortal(): Promise<void> {
  try {
    const { url } = await api<{ url?: string }>("/billing/portal", { body: {} });
    if (!url) throw new Error("no url");
    window.location.href = url;
  } catch {
    toast.error(i18n.t("pricing.portalError"));
  }
}

/** `consented` = the user ticked the terms + immediate-start checkbox in the upgrade dialog. */
async function startCheckout(interval: BillingInterval = "month", consented = false): Promise<void> {
  if (!consented) {
    toast.error(i18n.t("pricing.consentRequired"));
    return;
  }
  let url: string | undefined;
  try {
    const consent = { terms: true, immediateStart: true, at: new Date().toISOString() };
    url = (await api<{ url?: string }>("/billing/checkout", { body: { interval, consent } })).url;
  } catch (e) {
    // Already subscribed (e.g. second tab) → manage the existing subscription instead.
    if (e instanceof ApiError && e.body?.error === "already_pro") return openPortal();
    toast.error(i18n.t("pricing.checkoutError"));
    return;
  }
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
