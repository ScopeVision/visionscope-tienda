import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import es from "./locales/es.json";
import ca from "./locales/ca.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español" },
  { code: "ca", label: "Català" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      ca: { translation: ca },
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "es",
    supportedLngs: ["es", "ca", "en", "fr"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "lillo-lang",
    },
  });

export default i18n;

/** Returns the localized field for a row, falling back to ES then to any non-empty value. */
export function localized<T extends Record<string, any>>(
  row: T | null | undefined,
  base: string,
  lang: string
): string {
  if (!row) return "";
  const candidates = [`${base}_${lang}`, `${base}_es`, `${base}_en`, `${base}_ca`, `${base}_fr`];
  for (const key of candidates) {
    const v = row[key];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return "";
}
