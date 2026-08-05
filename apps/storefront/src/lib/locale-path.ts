import {
  canonicalizePublicIdentityPath,
  normalizeCmsPath,
  stripLocalePrefix,
  type Locale,
} from "@mccoy/cms-schema";

/** Minimal page shape for NL/EN path pairing (CMS store or seed). */
export type LocalePathPage = {
  paths?: { nl?: string; en?: string };
  slug?: string;
};

function pageIdentities(page: LocalePathPage): { nl: string; en: string } {
  const nlRaw = (page.paths?.nl ?? page.slug ?? "/").replace(/\/+$/, "") || "/";
  const enRaw =
    (page.paths?.en ?? page.paths?.nl ?? page.slug ?? "/").replace(/\/+$/, "") || "/";
  return {
    nl: canonicalizePublicIdentityPath(nlRaw),
    en: canonicalizePublicIdentityPath(enRaw),
  };
}

/**
 * Longest CMS page identity that covers `identity` (exact or nested prefix).
 * Home (`/`) only matches the home identity itself.
 */
function findBestPageIdentities(
  identity: string,
  pages: readonly LocalePathPage[],
): { nl: string; en: string } | null {
  let best: { nl: string; en: string; len: number } | null = null;

  for (const page of pages) {
    const { nl, en } = pageIdentities(page);
    for (const base of [nl, en]) {
      const matches =
        identity === base || (base !== "/" && identity.startsWith(`${base}/`));
      if (!matches) continue;
      const len = base.length;
      if (!best || len > best.len) best = { nl, en, len };
    }
  }

  return best ? { nl: best.nl, en: best.en } : null;
}

/**
 * Build a public locale URL from an identity path that may include nested segments.
 * `normalizeCmsPath` is single-segment safe (normalizeSlug strips `/`); nested
 * suffixes are appended literally after normalizing the page base only.
 */
function toLocalePublicPath(locale: Locale, identityPath: string): string {
  const trimmed = identityPath.replace(/\/+$/, "") || "/";
  if (!trimmed.includes("/", 1)) {
    return normalizeCmsPath(locale, trimmed);
  }
  const segments = trimmed.split("/").filter(Boolean);
  const base = `/${segments[0]}`;
  const suffix = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "";
  const localizedBase = normalizeCmsPath(locale, base);
  if (!suffix) return localizedBase;
  return localizedBase === "/" ? suffix : `${localizedBase}${suffix}`;
}

/**
 * Map a public pathname to the equivalent path in `target` locale.
 *
 * Rules:
 * 1. Strip `/en` prefix → identity path
 * 2. Apply PUBLIC_IDENTITY_PATH_ALIASES (e.g. `/producten` → `/products`)
 * 3. If a CMS page pair matches (exact or nested prefix), use that page's
 *    nl/en identities and preserve any path suffix (e.g. `/vacatures/foo`)
 * 4. Otherwise prefix/strip via locale path builder (canonical EN slugs)
 */
export function mapPathnameToLocale(
  pathname: string,
  target: Locale,
  pages: readonly LocalePathPage[] = [],
): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const { path: rawIdentity } = stripLocalePrefix(trimmed);
  const identity = canonicalizePublicIdentityPath(rawIdentity.replace(/\/+$/, "") || "/");

  const pair = findBestPageIdentities(identity, pages);
  if (pair) {
    const underNl = identity === pair.nl || identity.startsWith(`${pair.nl}/`);
    const base = underNl
      ? pair.nl
      : identity === pair.en || identity.startsWith(`${pair.en}/`)
        ? pair.en
        : pair.nl;
    const suffix = identity === base ? "" : identity.slice(base.length);
    const targetBase = target === "en" ? pair.en : pair.nl;
    return toLocalePublicPath(target, `${targetBase}${suffix}` || "/");
  }

  return toLocalePublicPath(target, identity);
}
