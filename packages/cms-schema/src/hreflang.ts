/**
 * Phase 3 SEO — hreflang acceptance helpers.
 *
 * Never emit hreflang toward unpublished, redirected, noindex, or missing pages.
 * Does not invent English marketing/legal copy.
 */

import type { CmsPage } from "./types";
import type { LocaleAlternate } from "./paths";
import { absoluteCanonicalUrl, CANONICAL_SITE_ORIGIN } from "./resolve-seo";

/** True when robots meta/header would block indexing. */
export function robotsIndicateNoindex(robots?: string | null): boolean {
  if (!robots) return false;
  return /\bnoindex\b/i.test(robots);
}

/**
 * Legal EN pages (`/en/terms`, `/en/privacy`) without EN overlays still render
 * Dutch body via NL base fallback — treat as Dutch bleed: noindex + no hreflang.
 * A distinct EN meta title alone is not enough (body would still be Dutch).
 */
export function isEnglishLegalDutchBleed(page: CmsPage): boolean {
  if (page.kind !== "builtin") return false;
  if (page.pageKey !== "terms" && page.pageKey !== "privacy") return false;

  const drafts = page.enFieldDrafts ?? {};
  const hasBodyOverlay = Object.entries(drafts).some(([path, value]) => {
    if (!value?.trim()) return false;
    if (path.startsWith("section:terms.main:") || path.startsWith("section:privacy.main:")) {
      return true;
    }
    // Migrated legal blocks: heading / article title / body overlays.
    if (
      path.startsWith("block:") &&
      (path.includes(":heading") ||
        path.includes(":title") ||
        path.includes(":body") ||
        path.includes(":articles"))
    ) {
      return true;
    }
    return false;
  });
  return !hasBodyOverlay;
}

/** Whether a published locale may appear in hreflang / xhtml:link alternates. */
export function isHreflangEligibleLocale(input: {
  publicationState?: string | null;
  robots?: string | null;
  /** Explicit override (e.g. legal Dutch bleed). Default true when published. */
  indexable?: boolean;
}): boolean {
  if (input.publicationState !== "published") return false;
  if (input.indexable === false) return false;
  if (robotsIndicateNoindex(input.robots)) return false;
  return true;
}

export type HreflangPeerProbe = {
  /** Policy: published revision exists for this locale path. */
  published: boolean;
  /** Expected public HTTP outcome when resolved (unit tests use policy, not live curl). */
  httpStatus: 200 | 301 | 302 | 404 | 410;
  canonical: string;
  inLanguage: "nl" | "en";
  robots?: string | null;
  alternates: Array<{ locale: string; url: string }>;
};

export type HreflangAcceptanceInput = {
  originLocale: "nl" | "en";
  originCanonical: string;
  originInLanguage: "nl" | "en";
  originRobots?: string | null;
  /** Alternates emitted on the origin page head (hreflang links). */
  originAlternates: Array<{ locale: string; url: string }>;
  /** Peer locale probe when a published pair is claimed. */
  peer?: HreflangPeerProbe | null;
};

export type HreflangAcceptanceResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

function normalizeUrl(url: string, origin = CANONICAL_SITE_ORIGIN): string {
  try {
    const abs = url.startsWith("http") ? url : absoluteCanonicalUrl(url, origin);
    const u = new URL(abs);
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.origin}${path === "/" ? "" : path}`;
  } catch {
    return url;
  }
}

/**
 * Acceptance for one published NL↔EN hreflang claim from the origin page.
 * When origin does not advertise the peer locale, returns ok (nothing to reciprocate).
 */
export function acceptHreflangPair(input: HreflangAcceptanceInput): HreflangAcceptanceResult {
  const reasons: string[] = [];
  const originCanon = normalizeUrl(input.originCanonical);
  const peerLocale = input.originLocale === "nl" ? "en" : "nl";
  const peerAlt = input.originAlternates.find((a) => a.locale === peerLocale);

  if (robotsIndicateNoindex(input.originRobots)) {
    if (peerAlt) {
      reasons.push("origin is noindex but still emits peer hreflang");
    }
    return reasons.length ? { ok: false, reasons } : { ok: true };
  }

  if (input.originInLanguage !== input.originLocale) {
    reasons.push(
      `origin inLanguage "${input.originInLanguage}" does not match URL locale "${input.originLocale}"`,
    );
  }

  const selfAlt = input.originAlternates.find((a) => a.locale === input.originLocale);
  if (selfAlt && normalizeUrl(selfAlt.url) !== originCanon) {
    reasons.push("self hreflang does not match self-canonical");
  }

  if (!peerAlt) {
    return reasons.length ? { ok: false, reasons } : { ok: true };
  }

  if (!input.peer) {
    reasons.push(`hreflang ${peerLocale} emitted but peer probe missing`);
    return { ok: false, reasons };
  }

  const peer = input.peer;
  if (!peer.published) {
    reasons.push("hreflang points at unpublished peer");
  }
  if (peer.httpStatus !== 200) {
    reasons.push(`hreflang peer would be HTTP ${peer.httpStatus}, not 200`);
  }
  if (robotsIndicateNoindex(peer.robots)) {
    reasons.push("hreflang points at noindex peer");
  }
  if (peer.inLanguage !== peerLocale) {
    reasons.push(`peer inLanguage "${peer.inLanguage}" does not match "${peerLocale}"`);
  }
  if (normalizeUrl(peer.canonical) !== normalizeUrl(peerAlt.url)) {
    reasons.push("hreflang href does not match peer self-canonical");
  }

  const back = peer.alternates.find((a) => a.locale === input.originLocale);
  if (!back) {
    reasons.push("peer does not reciprocate hreflang to origin");
  } else if (normalizeUrl(back.url) !== originCanon) {
    reasons.push("peer reciprocal hreflang does not match origin canonical");
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/**
 * Assert reciprocity across both sides of a published pair (test helper).
 */
export function assertReciprocalHreflangPair(input: {
  nl: {
    canonical: string;
    robots?: string | null;
    alternates: Array<{ locale: string; url: string }>;
  };
  en: {
    canonical: string;
    robots?: string | null;
    alternates: Array<{ locale: string; url: string }>;
    published: boolean;
    httpStatus: 200 | 301 | 302 | 404 | 410;
  };
}): HreflangAcceptanceResult {
  const nlResult = acceptHreflangPair({
    originLocale: "nl",
    originCanonical: input.nl.canonical,
    originInLanguage: "nl",
    originRobots: input.nl.robots,
    originAlternates: input.nl.alternates,
    peer: {
      published: input.en.published,
      httpStatus: input.en.httpStatus,
      canonical: input.en.canonical,
      inLanguage: "en",
      robots: input.en.robots,
      alternates: input.en.alternates,
    },
  });
  if (!nlResult.ok) return nlResult;

  return acceptHreflangPair({
    originLocale: "en",
    originCanonical: input.en.canonical,
    originInLanguage: "en",
    originRobots: input.en.robots,
    originAlternates: input.en.alternates,
    peer: {
      published: true,
      httpStatus: 200,
      canonical: input.nl.canonical,
      inLanguage: "nl",
      robots: input.nl.robots,
      alternates: input.nl.alternates,
    },
  });
}

/** Map LocaleAlternate[] to the lighter shape used by acceptance checks. */
export function alternatesToHreflangLinks(
  alts: LocaleAlternate[],
): Array<{ locale: string; url: string }> {
  return alts.map((a) => ({ locale: a.locale, url: a.url }));
}
