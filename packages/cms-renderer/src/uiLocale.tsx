import * as React from "react";
import type { Locale } from "@mccoy/cms-schema";

const CmsUiLocaleContext = React.createContext<Locale>("nl");

/** Provides active UI/CMS locale to block chrome (offer price labels, empty states). */
export function CmsUiLocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <CmsUiLocaleContext.Provider value={locale}>{children}</CmsUiLocaleContext.Provider>;
}

export function useCmsUiLocale(): Locale {
  return React.useContext(CmsUiLocaleContext);
}
