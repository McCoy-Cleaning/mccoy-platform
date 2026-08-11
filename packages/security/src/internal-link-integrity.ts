/**
 * Phase 8 SEO — internal-link integrity gate.
 *
 * Pure checks (no network): McCoy-owned hrefs on major public surfaces must
 * point at canonical 200 destinations — not Phase 2 legacy redirect/gone URLs,
 * not noncanonical slash/host variants, not wrong-locale peers when known.
 */

import { CANONICAL_PUBLIC_HOST, stripTrailingSlashPath } from "./host";
import {
  LEGACY_GONE_PATHS,
  LEGACY_PERMANENT_REDIRECTS,
} from "./legacy-redirects";

/** Major public NL/EN paths that are expected to serve 200 (identity, no hash). */
export const MAJOR_PUBLIC_CANONICAL_PATHS: readonly string[] = [
  "/",
  "/about",
  "/services",
  "/products",
  "/contact",
  "/offerte",
  "/vacatures",
  "/privacy",
  "/terms",
  "/schoonmaakbedrijf-enschede",
  "/schoonmaakbedrijf-hengelo",
  "/en",
  "/en/about",
  "/en/services",
  "/en/products",
  "/en/contact",
  "/en/offerte",
  "/en/vacatures",
  "/en/privacy",
  "/en/terms",
];

/**
 * Identity aliases that soft-redirect to a different canonical path.
 * Keep aligned with `PUBLIC_IDENTITY_PATH_ALIASES` in `@mccoy/cms-schema`.
 */
export const PUBLIC_IDENTITY_ALIAS_PATHS: Readonly<Record<string, string>> = {
  "/producten": "/products",
  "/aanbiedingen": "/products",
  "/offers": "/products",
  "/jobs": "/vacatures",
  "/careers": "/vacatures",
};

export type InternalLinkIntegrityReason =
  | "legacy_redirect"
  | "gone"
  | "identity_alias"
  | "noncanonical_slash"
  | "noncanonical_host"
  | "wrong_locale"
  | "unknown_path";

export type InternalLinkIntegrityIssue = {
  href: string;
  source?: string;
  reason: InternalLinkIntegrityReason;
  detail?: string;
};

export type InternalLinkRef = {
  href: string;
  /** Route or chrome surface that emitted the link (for diagnostics). */
  source?: string;
  /**
   * Locale of the page HTML that contains the link.
   * When `en`, bare NL peers for known EN canonicals are rejected.
   */
  sourceLocale?: "nl" | "en";
};

export type InternalLinkIntegrityOptions = {
  canonicalPathnames?: ReadonlySet<string> | readonly string[];
  /** Extra denylist path → preferred canonical (defaults include identity aliases). */
  aliasPathnames?: Readonly<Record<string, string>>;
  /**
   * When true (default), hrefs whose path is not in the canonical set fail.
   * Set false for partial inventories.
   */
  requireKnownCanonical?: boolean;
};

function toCanonicalSet(
  input: ReadonlySet<string> | readonly string[] | undefined,
): ReadonlySet<string> {
  if (!input) return new Set(MAJOR_PUBLIC_CANONICAL_PATHS);
  return input instanceof Set ? input : new Set(input);
}

function stripPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

function isLocalHost(host: string): boolean {
  const h = stripPort(host);
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

/**
 * Parse a McCoy-owned href into path + metadata.
 * Returns null for non-McCoy / non-navigational hrefs (mailto, tel, external).
 */
export function parseMccoyInternalHref(href: string): {
  pathname: string;
  hadTrailingSlash: boolean;
  host: string | null;
  hash: string;
  search: string;
} | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") return null;
  if (
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }

  // In-page hash only — not a cross-route integrity concern.
  if (trimmed.startsWith("#")) return null;

  let url: URL;
  try {
    if (trimmed.startsWith("//")) {
      url = new URL(`https:${trimmed}`);
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      url = new URL(trimmed);
    } else if (trimmed.startsWith("/")) {
      url = new URL(trimmed, `https://${CANONICAL_PUBLIC_HOST}`);
    } else {
      return null;
    }
  } catch {
    return null;
  }

  const host = stripPort(url.hostname);
  const isMccoy =
    !host ||
    host === CANONICAL_PUBLIC_HOST ||
    host === "mccoy.nl" ||
    isLocalHost(host);
  if (!isMccoy) return null;

  const rawPath = url.pathname || "/";
  const hadTrailingSlash = rawPath.length > 1 && rawPath.endsWith("/");
  return {
    pathname: stripTrailingSlashPath(rawPath),
    hadTrailingSlash,
    host: host || null,
    hash: url.hash,
    search: url.search,
  };
}

function enPeerPath(nlPath: string): string {
  if (nlPath === "/") return "/en";
  return `/en${nlPath}`;
}

function stripEnPrefix(path: string): string {
  if (path === "/en") return "/";
  if (path.startsWith("/en/")) return path.slice(3) || "/";
  return path;
}

/**
 * Evaluate one McCoy-owned href. Non-McCoy / skipped hrefs return null (ok/skip).
 */
export function evaluateInternalLinkHref(
  href: string,
  options?: InternalLinkIntegrityOptions & { sourceLocale?: "nl" | "en" },
): InternalLinkIntegrityIssue | null {
  const parsed = parseMccoyInternalHref(href);
  if (!parsed) return null;

  const canonical = toCanonicalSet(options?.canonicalPathnames);
  const aliases = options?.aliasPathnames ?? PUBLIC_IDENTITY_ALIAS_PATHS;
  const requireKnown = options?.requireKnownCanonical !== false;
  const path = parsed.pathname;

  if (parsed.host && parsed.host !== CANONICAL_PUBLIC_HOST && !isLocalHost(parsed.host)) {
    // Apex mccoy.nl is a host hop away from www canonical.
    if (parsed.host === "mccoy.nl") {
      return {
        href,
        reason: "noncanonical_host",
        detail: `Use https://${CANONICAL_PUBLIC_HOST} or a root-relative path`,
      };
    }
  }

  if (parsed.hadTrailingSlash) {
    return {
      href,
      reason: "noncanonical_slash",
      detail: `Prefer ${path}${parsed.search}${parsed.hash}`,
    };
  }

  if (LEGACY_GONE_PATHS.has(path) || LEGACY_GONE_PATHS.has(stripEnPrefix(path))) {
    return {
      href,
      reason: "gone",
      detail: "Phase 2 legacy 410 path — do not link",
    };
  }

  const legacyTo =
    LEGACY_PERMANENT_REDIRECTS[path] ??
    LEGACY_PERMANENT_REDIRECTS[stripEnPrefix(path)];
  if (legacyTo) {
    return {
      href,
      reason: "legacy_redirect",
      detail: `Use ${legacyTo} directly (Phase 2 denylist)`,
    };
  }

  const aliasTo = aliases[path] ?? aliases[stripEnPrefix(path)];
  if (aliasTo) {
    return {
      href,
      reason: "identity_alias",
      detail: `Use ${aliasTo} directly`,
    };
  }

  if (options?.sourceLocale === "en") {
    const isEnPath = path === "/en" || path.startsWith("/en/");
    if (!isEnPath && canonical.has(enPeerPath(path))) {
      return {
        href,
        reason: "wrong_locale",
        detail: `EN page should link to ${enPeerPath(path)}${parsed.hash}`,
      };
    }
  }

  if (requireKnown && !canonical.has(path)) {
    // Nested vacatures slugs: allow /vacatures/* and /en/vacatures/* as 200-ish.
    const underVacatures =
      path.startsWith("/vacatures/") || path.startsWith("/en/vacatures/");
    if (!underVacatures) {
      return {
        href,
        reason: "unknown_path",
        detail: "Not in major public canonical path set",
      };
    }
  }

  return null;
}

export function collectInternalLinkIntegrityIssues(
  links: readonly InternalLinkRef[],
  options?: InternalLinkIntegrityOptions,
): InternalLinkIntegrityIssue[] {
  const issues: InternalLinkIntegrityIssue[] = [];
  for (const link of links) {
    const issue = evaluateInternalLinkHref(link.href, {
      ...options,
      sourceLocale: link.sourceLocale,
    });
    if (issue) {
      issues.push({
        ...issue,
        source: link.source ?? issue.source,
      });
    }
  }
  return issues;
}

export function assertInternalLinkIntegrity(
  links: readonly InternalLinkRef[],
  options?: InternalLinkIntegrityOptions,
): void {
  const issues = collectInternalLinkIntegrityIssues(links, options);
  if (issues.length === 0) return;
  const lines = issues.map(
    (i) =>
      `- [${i.reason}] ${i.href}${i.source ? ` (from ${i.source})` : ""}${
        i.detail ? `: ${i.detail}` : ""
      }`,
  );
  throw new Error(
    `Internal-link integrity gate failed (${issues.length}):\n${lines.join("\n")}`,
  );
}
