import { useRouterState } from "@tanstack/react-router";
import type { Locale } from "@mccoy/cms-schema";
import { useI18n } from "@/lib/i18n";

function previewLocaleFromSearch(search: unknown): Locale | null {
  if (search && typeof search === "object" && "_cmsLocale" in search) {
    const v = (search as { _cmsLocale?: unknown })._cmsLocale;
    if (v === "en" || v === "nl") return v;
  }
  return null;
}

function previewLocaleFromWindow(): Locale | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("_cmsLocale");
  if (v === "en" || v === "nl") return v;
  return null;
}

/**
 * Active CMS locale for public + preview rendering.
 *
 * Priority:
 * 1. Authenticated preview `?_cmsLocale=` (router search, else window query)
 * 2. URL `/en/...`
 * 3. Client i18n lang (SSR-seeded from cookie / Accept-Language / URL — same as chrome)
 *
 * This keeps static UI and database-driven sections on one locale, including when
 * `/en` is unpublished and the toggle stays on the NL path (historical storefront UX).
 */
export function useActiveCmsLocale(): Locale {
  const { lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  const preview =
    previewLocaleFromSearch(search) ??
    // Routes without validateSearch may omit `_cmsLocale` from the search object;
    // fall back to the raw query (and window) so Admin edit-canvas locale works.
    (() => {
      const fromStr = new URLSearchParams(searchStr ?? "").get("_cmsLocale");
      if (fromStr === "en" || fromStr === "nl") return fromStr;
      return previewLocaleFromWindow();
    })();

  if (preview) return preview;

  const onEnPath = pathname === "/en" || pathname.startsWith("/en/");
  if (onEnPath) return "en";
  return lang === "en" ? "en" : "nl";
}
