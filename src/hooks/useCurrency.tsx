import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Currency = "USD" | "CZK";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggle: () => void;
  exchangeRate: number;
  rateDate: string | null;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "CZK",
  setCurrency: () => {},
  toggle: () => {},
  exchangeRate: 23.5,
  rateDate: null,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    return (localStorage.getItem("currency") as Currency) || "CZK";
  });
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const cached = localStorage.getItem("exchangeRate");
    return cached ? parseFloat(cached) : 23.5;
  });
  const [rateDate, setRateDate] = useState<string | null>(() => {
    return localStorage.getItem("exchangeRateDate");
  });

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-exchange-rate");
        if (error) throw error;
        if (data?.rate) {
          setExchangeRate(data.rate);
          setRateDate(data.date || null);
          localStorage.setItem("exchangeRate", String(data.rate));
          if (data.date) localStorage.setItem("exchangeRateDate", data.date);
        }
      } catch (e) {
        console.warn("Failed to fetch exchange rate, using cached/fallback:", e);
      }
    };
    fetchRate();
  }, []);

  const toggle = () => {
    setCurrency((prev) => {
      const next = prev === "CZK" ? "USD" : "CZK";
      localStorage.setItem("currency", next);
      return next;
    });
  };

  const set = (c: Currency) => {
    localStorage.setItem("currency", c);
    setCurrency(c);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: set, toggle, exchangeRate, rateDate }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
