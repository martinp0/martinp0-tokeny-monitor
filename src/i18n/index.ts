import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import cs from "./cs.json";
import en from "./en.json";

const isBrowser = typeof window !== "undefined";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
    },
    fallbackLng: "cs",
    // Pin the prerender language. The browser still detects localStorage / <html lang>.
    ...(isBrowser ? {} : { lng: "cs" }),
    interpolation: {
      escapeValue: false,
    },
    react: { useSuspense: false },
    detection: {
      order: ["querystring", "localStorage", "htmlTag"],
      lookupQuerystring: "lang",
      lookupLocalStorage: "tokeny_lang",
      caches: isBrowser ? ["localStorage"] : [],
    },
  });

export default i18n;
