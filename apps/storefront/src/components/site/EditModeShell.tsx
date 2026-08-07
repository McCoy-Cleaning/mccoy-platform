import type { ReactNode } from "react";
import * as React from "react";
import { useLocation } from "@tanstack/react-router";
import { useEdit } from "@/lib/cms/edit-mode-context";
import { EditInteractionGuard } from "@/components/site/EditInteractionGuard";
import { useI18n } from "@/lib/i18n";
import { useActiveCmsLocale } from "@/lib/cms/use-active-cms-locale";

/**
 * Blocks navigation/submit while inside the admin edit iframe or on the
 * noindex /cms-preview route. Guard is Storefront-local (not the authoring package).
 *
 * Also mirrors Admin `?_cmsLocale=` into client i18n so static catalogs (forms,
 * chrome) match CMS EN overlays — LanguageToggle clicks are blocked in edit mode.
 */
export function EditModeShell({ children }: { children: ReactNode }) {
  const { mode } = useEdit();
  const location = useLocation();
  const isPreviewRoute = location.pathname === "/cms-preview";
  const { lang, setLang } = useI18n();
  const previewLocale = useActiveCmsLocale();

  React.useEffect(() => {
    if (mode !== "edit" && !isPreviewRoute) return;
    if (previewLocale !== lang) setLang(previewLocale);
  }, [mode, isPreviewRoute, previewLocale, lang, setLang]);

  const guardMode: "edit" | "preview" | "off" = mode === "edit" ? "edit" : isPreviewRoute ? "preview" : "off";

  if (guardMode === "off") return <>{children}</>;

  return <EditInteractionGuard mode={guardMode}>{children}</EditInteractionGuard>;
}
