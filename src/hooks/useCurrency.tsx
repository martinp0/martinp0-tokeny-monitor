import { createContext, useContext, useState, type ReactNode } from "react";

export type Currency = "USD" | "CZK";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggle: () => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "CZK",
  setCurrency: () => {},
  toggle: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    return (localStorage.getItem("currency") as Currency) || "CZK";
  });

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
    <CurrencyContext.Provider value={{ currency, setCurrency: set, toggle }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
