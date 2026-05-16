import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import cs from "./cs.json";
import en from "./en.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      cs: { translation: cs },
      en: { translation: en },
    },
    fallbackLng: "cs",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "htmlTag"],
      lookupLocalStorage: "tokeny_lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
