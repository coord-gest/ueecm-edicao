import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";

/**
 * i18n scaffold. PT-BR é o idioma padrão e o único carregado hoje.
 * Novos idiomas podem ser adicionados em ./locales/<lang>.json e
 * registrados no objeto `resources` abaixo.
 *
 * Uso em componentes:
 *   const { t } = useTranslation();
 *   t("common.save");
 */

export const defaultLocale = "pt-BR" as const;
export const supportedLocales = ["pt-BR"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

let initialized = false;
export function initI18n() {
  if (initialized) return i18n;
  initialized = true;
  void i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": { translation: ptBR },
    },
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: supportedLocales as unknown as string[],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return i18n;
}

export default i18n;
