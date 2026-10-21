import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type Currency = "USD" | "CZK";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggle: () => void;
  exchangeRate: number;
  rateDate: string | null;
  /** Loads the ČNB rate. The homepage calls this when the demo is shown. */
  prefetchExchangeRate: () => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "CZK",
  setCurrency: () => {},
  toggle: () => {},
  exchangeRate: 23.5,
  rateDate: null,
  prefetchExchangeRate: () => {},
});

function storedCurrency(): Currency {
  if (typeof window === "undefined") return "CZK";
  const value = localStorage.getItem("currency");
  return value === "USD" || value === "CZK" ? value : "CZK";
}

function storedRate(): number {
  if (typeof window === "undefined") return 23.5;
  const cached = localStorage.getItem("exchangeRate");
  const parsed = cached ? parseFloat(cached) : NaN;
  return Number.isFinite(parsed) ? parsed : 23.5;
}

function storedRateDate(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("exchangeRateDate");
}

let rateRequest: Promise<void> | null = null;

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [currency, setCurrency] = useState<Currency>(storedCurrency);
  const [exchangeRate, setExchangeRate] = useState<number>(storedRate);
  const [rateDate, setRateDate] = useState<string | null>(storedRateDate);

  const applyRate = useCallback((rate: number, date: string | null) => {
    setExchangeRate(rate);
    setRateDate(date);
  }, []);

  const prefetchExchangeRate = useCallback(() => {
    if (!rateRequest) {
      rateRequest = import("@/integrations/supabase/client")
        .then(({ supabase }) =>
          supabase
            .from("exchange_rates")
            .select("rate, source_date")
            .eq("currency_pair", "USD_CZK")
            .single(),
        )
        .then(({ data: dbRate }) => {
          if (!dbRate?.rate) return;
          const rate = Number(dbRate.rate);
          const date = dbRate.source_date || null;
          localStorage.setItem("exchangeRate", String(rate));
          if (date) localStorage.setItem("exchangeRateDate", date);
          applyRate(rate, date);
        })
        .catch(() => {
          rateRequest = null;
        });
    }
    return rateRequest;
  }, [applyRate]);

  useEffect(() => {
    // Keep the Supabase client off the homepage critical path.
    if (location.pathname === "/") return;
    void prefetchExchangeRate();
  }, [location.pathname, prefetchExchangeRate]);

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
    <CurrencyContext.Provider value={{ currency, setCurrency: set, toggle, exchangeRate, rateDate, prefetchExchangeRate }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
