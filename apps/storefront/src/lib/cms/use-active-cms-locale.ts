import { useRouterState } from "@tanstack/react-router";
import type { Locale } from "@mccoy/cms-schema";
import { useI18n } from "@/lib/i18n";

/**
 * Active CMS locale for public + preview rendering.
 *
 * Priority:
 * 1. Authenticated preview `?_cmsLocale=`
 * 2. Client i18n lang (language toggle / localStorage) — same source as chrome catalogs
 * 3. URL `/en/...` as a floor when already on an English route
 *
 * This keeps static UI and database-driven sections on one locale, including when
 * `/en` is unpublished and the toggle stays on the NL path (historical storefront UX).
 */
export function useActiveCmsLocale(): Locale {
  const { lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });

  const preview =
    search &&
    typeof search === "object" &&
    "_cmsLocale" in search &&
    ((search as { _cmsLocale?: unknown })._cmsLocale === "en" ||
      (search as { _cmsLocale?: unknown })._cmsLocale === "nl")
      ? ((search as { _cmsLocale: "nl" | "en" })._cmsLocale as Locale)
      : null;

  if (preview) return preview;

  const onEnPath = pathname === "/en" || pathname.startsWith("/en/");
  if (onEnPath) return "en";
  return lang === "en" ? "en" : "nl";
}
