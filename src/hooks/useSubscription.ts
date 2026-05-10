import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionStatus {
  isPro: boolean;
  currentPeriodEnd: string | null;
}

async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { data, error } = await supabase.functions.invoke("check-subscription");
  if (error) throw error;
  return data as SubscriptionStatus;
}

export function useSubscription() {
  const { data, isLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: fetchSubscriptionStatus,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  async function startCheckout() {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      const url = (data as { url: string }).url;
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nepodařilo se zahájit platbu");
    }
  }

  return {
    isPro: data?.isPro ?? false,
    loading: isLoading,
    currentPeriodEnd: data?.currentPeriodEnd ?? null,
    startCheckout,
  };
}
