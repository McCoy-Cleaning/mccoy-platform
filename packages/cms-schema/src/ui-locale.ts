/**
 * Public UI locale preference (chrome catalogs + EN field overlays).
 * Distinct from CMS URL locale used for published `/en/...` snapshots.
 *
 * Priority: URL path → cookie → Accept-Language → default `nl`.
 */
import type { Locale } from "./locale";

export const UI_LOCALE_COOKIE = "mccoy-lang";

export type UiLocaleSource = "url" | "cookie" | "accept-language" | "default";

export type UiLocaleResolution = {
  locale: Locale;
  source: UiLocaleSource;
};

export function parseLocaleToken(value: string | null | undefined): Locale | null {
  if (value === "nl" || value === "en") return value;
  return null;
}

/** Read `mccoy-lang` (or custom name) from a Cookie header / document.cookie string. */
export function preferredLocaleFromCookie(
  cookieHeader: string | null | undefined,
  cookieName: string = UI_LOCALE_COOKIE,
): Locale | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== cookieName) continue;
    return parseLocaleToken(decodeURIComponent(trimmed.slice(eq + 1).trim()));
  }
  return null;
}

/**
 * Best UI locale from Accept-Language. Prefers the highest-q tag that maps to
 * `nl` or `en`; returns null when the header is missing/unusable so callers
 * can fall through to the Dutch default.
 */
export function preferredLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header || !header.trim()) return null;

  const candidates: Array<{ locale: Locale; q: number }> = [];
  for (const raw of header.split(",")) {
    const [tagPart, ...params] = raw.trim().split(";").map((s) => s.trim());
    if (!tagPart) continue;
    const primary = tagPart.toLowerCase().split("-")[0];
    if (primary !== "nl" && primary !== "en") continue;
    let q = 1;
    for (const param of params) {
      const m = /^q=(.*)$/i.exec(param);
      if (!m) continue;
      const parsed = Number.parseFloat(m[1] ?? "");
      if (Number.isFinite(parsed)) q = parsed;
    }
    candidates.push({ locale: primary, q });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.q - a.q);
  return candidates[0]!.locale;
}

export function resolveUiLocale(input: {
  pathname: string;
  cookieLocale?: Locale | null;
  acceptLanguageLocale?: Locale | null;
}): UiLocaleResolution {
  const p = input.pathname.startsWith("/") ? input.pathname : `/${input.pathname}`;
  if (p === "/en" || p.startsWith("/en/")) {
    return { locale: "en", source: "url" };
  }
  if (input.cookieLocale === "nl" || input.cookieLocale === "en") {
    return { locale: input.cookieLocale, source: "cookie" };
  }
  if (input.acceptLanguageLocale === "nl" || input.acceptLanguageLocale === "en") {
    return { locale: input.acceptLanguageLocale, source: "accept-language" };
  }
  return { locale: "nl", source: "default" };
}

/**
 * Assemble UI locale from raw request/browser hints.
 * Priority: URL → cookie → fallbackLocale (e.g. localStorage) → Accept-Language → nl.
 */
export function resolveUiLangFromHints(input: {
  pathname: string;
  cookieHeader?: string | null;
  acceptLanguage?: string | null;
  /** Used like cookie when the cookie is absent (legacy client localStorage). */
  fallbackLocale?: Locale | null;
}): Locale {
  const cookieLocale =
    preferredLocaleFromCookie(input.cookieHeader) ?? input.fallbackLocale ?? null;
  return resolveUiLocale({
    pathname: input.pathname,
    cookieLocale,
    acceptLanguageLocale: preferredLocaleFromAcceptLanguage(input.acceptLanguage),
  }).locale;
}

/**
 * When CMS heading already ends with the accent word (common when EN drafts
 * store a full sentence while `headingAccent` still falls back to the catalog),
 * keep a single accent span and strip the duplicate from the plain heading.
 */
export function resolveHeroHeadingParts(
  heading: string,
  accent: string | undefined | null,
): { heading: string; headingAccent: string } {
  const headingTrim = heading.trim();
  const accentTrim = (accent ?? "").trim();
  if (!accentTrim) return { heading: headingTrim, headingAccent: "" };

  const escaped = accentTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const dup = new RegExp(`(?:\\s|^)${escaped}\\s*$`, "i");
  if (dup.test(headingTrim)) {
    return {
      heading: headingTrim.replace(dup, "").trimEnd(),
      headingAccent: accentTrim,
    };
  }
  return { heading: headingTrim, headingAccent: accentTrim };
}
