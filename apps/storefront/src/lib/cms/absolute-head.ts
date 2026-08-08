import {
  absoluteCanonicalUrl,
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalOrigin,
} from "@mccoy/cms-schema";

/** Absolute www canonical link for non-CMS or hybrid route heads. */
export function absoluteCanonicalLink(pathname: string) {
  return {
    rel: "canonical" as const,
    href: absoluteCanonicalUrl(pathname, CANONICAL_SITE_ORIGIN),
  };
}

export function absoluteOgUrl(pathname: string): string {
  return absoluteCanonicalUrl(pathname, CANONICAL_SITE_ORIGIN);
}

export function publicCanonicalOrigin(): string {
  return resolveCanonicalOrigin(CANONICAL_SITE_ORIGIN);
}
