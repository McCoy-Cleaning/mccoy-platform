import { z } from "zod";
import type { BuiltinRouteKey, CmsLink, CmsLinkPageRef } from "./cms-link-model";

export type { BuiltinRouteKey, CmsLink, CmsLinkPageRef } from "./cms-link-model";

export const BUILTIN_ROUTE_PATHS: Record<BuiltinRouteKey, string> = {
  home: "/",
  services: "/services",
  products: "/products",
  about: "/about",
  contact: "/contact",
  vacatures: "/vacatures",
  offerte: "/offerte",
  privacy: "/privacy",
  terms: "/terms",
};

export const BUILTIN_ROUTE_LABELS: Record<BuiltinRouteKey, string> = {
  home: "Home",
  services: "Diensten",
  products: "Producten",
  about: "Over ons",
  contact: "Contact",
  vacatures: "Vacatures",
  offerte: "Offerte",
  privacy: "Privacyverklaring",
  terms: "Algemene voorwaarden",
};

/**
 * User-facing NL labels for link kinds (never expose "CMS").
 * UI collapses internal_route + internal into one “Pagina” control with grouped options.
 */
export const CMS_LINK_KIND_LABELS_NL = {
  none: "Geen link",
  internal_route: "Pagina",
  internal: "Pagina",
  external: "Externe link",
  email: "E-mailadres",
  phone: "Telefoonnummer",
} as const;

/** Segmented-control labels when Pagina is a single combined tab. */
export const CMS_LINK_UI_LABELS_NL = {
  none: "Geen link",
  page: "Pagina",
  external: "Externe link",
  email: "E-mailadres",
  phone: "Telefoonnummer",
} as const;

export type CmsLinkKind = CmsLink["type"];

const ALLOWED_SCHEMES = new Set(["https:", "mailto:", "tel:"]);

export function isSafeExternalUrl(raw: string, options?: { allowHttpInDev?: boolean }): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (ALLOWED_SCHEMES.has(parsed.protocol)) return true;
  if (
    options?.allowHttpInDev &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
  ) {
    return true;
  }
  return false;
}

function isValidEmail(raw: string): boolean {
  const t = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function isValidPhone(raw: string): boolean {
  const t = raw.trim().replace(/[\s()-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(t);
}

export const cmsLinkSchema: z.ZodType<CmsLink> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("internal"),
    pageId: z.string().min(1),
    openInNewTab: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("internal_route"),
    route: z.enum([
      "home",
      "services",
      "products",
      "about",
      "contact",
      "vacatures",
      "offerte",
      "privacy",
      "terms",
    ]),
    openInNewTab: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("external"),
    url: z.string().min(1),
    openInNewTab: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("email"),
    email: z.string().min(1),
    subject: z.string().optional(),
  }),
  z.object({
    type: z.literal("phone"),
    phone: z.string().min(1),
  }),
]);

export function parseCmsLink(value: unknown): CmsLink | null {
  const parsed = cmsLinkSchema.safeParse(value);
  if (!parsed.success) return null;
  if (parsed.data.type === "none") return parsed.data;
  if (parsed.data.type === "external" && !isSafeExternalUrl(parsed.data.url, { allowHttpInDev: true })) {
    return null;
  }
  if (parsed.data.type === "email" && !isValidEmail(parsed.data.email)) {
    return null;
  }
  if (parsed.data.type === "phone" && !isValidPhone(parsed.data.phone)) {
    return null;
  }
  return parsed.data;
}

/**
 * Editor-facing parse: keep incomplete destinations (e.g. `https://` while typing)
 * so UI mode does not snap back to “geen link”. Still rejects dangerous schemes.
 * Publish / actionable checks continue to use {@link parseCmsLink}.
 */
export function parseCmsLinkDraft(value: unknown): CmsLink | null {
  const strict = parseCmsLink(value);
  if (strict) return strict;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const type = rec.type;

  if (type === "none") return { type: "none" };

  if (type === "external" && typeof rec.url === "string") {
    const trimmed = rec.url.trim();
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
    return {
      type: "external",
      url: rec.url,
      openInNewTab: typeof rec.openInNewTab === "boolean" ? rec.openInNewTab : true,
    };
  }

  if (type === "email" && typeof rec.email === "string") {
    return {
      type: "email",
      email: rec.email,
      subject: typeof rec.subject === "string" ? rec.subject : undefined,
    };
  }

  if (type === "phone" && typeof rec.phone === "string") {
    return { type: "phone", phone: rec.phone };
  }

  if (type === "internal" && typeof rec.pageId === "string" && rec.pageId.trim()) {
    return {
      type: "internal",
      pageId: rec.pageId,
      openInNewTab: typeof rec.openInNewTab === "boolean" ? rec.openInNewTab : undefined,
    };
  }

  if (type === "internal_route" && typeof rec.route === "string") {
    const route = rec.route as BuiltinRouteKey;
    if (!(route in BUILTIN_ROUTE_PATHS)) return null;
    return {
      type: "internal_route",
      route,
      openInNewTab: typeof rec.openInNewTab === "boolean" ? rec.openInNewTab : undefined,
    };
  }

  return null;
}

/** True when the link is a usable destination (not none / empty). */
export function isActionableCmsLink(link: CmsLink | null | undefined): boolean {
  if (!link || link.type === "none") return false;
  return parseCmsLink(link) != null;
}

/** Migrate legacy string hrefs into CmsLink where possible. */
export function linkFromLegacyHref(href: string | undefined | null): CmsLink | null {
  if (!href || !href.trim()) return null;
  const h = href.trim();
  if (h.startsWith("mailto:")) {
    const email = h.slice("mailto:".length).split("?")[0] ?? "";
    return isValidEmail(email) ? { type: "email", email } : null;
  }
  if (h.startsWith("tel:")) {
    const phone = h.slice("tel:".length);
    return isValidPhone(phone) ? { type: "phone", phone } : null;
  }
  const routeEntry = (Object.entries(BUILTIN_ROUTE_PATHS) as [BuiltinRouteKey, string][]).find(
    ([, path]) => path === h || (path !== "/" && h === path),
  );
  if (routeEntry) {
    return { type: "internal_route", route: routeEntry[0] };
  }
  if (h.startsWith("/") && !h.startsWith("//")) {
    return null;
  }
  if (isSafeExternalUrl(h, { allowHttpInDev: true })) {
    return { type: "external", url: h, openInNewTab: true };
  }
  return null;
}

export function resolveCmsLinkHref(
  link: CmsLink | null | undefined,
  pages: Pick<CmsLinkPageRef, "id" | "slug">[],
): string | null {
  if (!link || link.type === "none") return null;
  if (link.type === "external") {
    return isSafeExternalUrl(link.url, { allowHttpInDev: true }) ? link.url : null;
  }
  if (link.type === "email") {
    if (!isValidEmail(link.email)) return null;
    const base = `mailto:${link.email.trim()}`;
    return link.subject ? `${base}?subject=${encodeURIComponent(link.subject)}` : base;
  }
  if (link.type === "phone") {
    return isValidPhone(link.phone) ? `tel:${link.phone.trim().replace(/\s+/g, "")}` : null;
  }
  if (link.type === "internal_route") {
    return BUILTIN_ROUTE_PATHS[link.route] ?? null;
  }
  const page = pages.find((p) => p.id === link.pageId);
  return page?.slug ?? null;
}

export function linkRel(link: CmsLink | null | undefined): string | undefined {
  if (!link || link.type === "none" || link.type === "email" || link.type === "phone") return undefined;
  if (!("openInNewTab" in link) || !link.openInNewTab) return undefined;
  return "noopener noreferrer";
}

export function linkTarget(link: CmsLink | null | undefined): "_blank" | undefined {
  if (!link || link.type === "none" || link.type === "email" || link.type === "phone") return undefined;
  if (!("openInNewTab" in link)) return undefined;
  return link.openInNewTab ? "_blank" : undefined;
}

/** Human-readable destination for preview tooltips (NL). */
export function describeCmsLink(
  link: CmsLink | null | undefined,
  pages: Pick<CmsLinkPageRef, "id" | "slug" | "title">[] = [],
): string {
  if (!link || link.type === "none") return "Geen link";
  if (link.type === "internal_route") return BUILTIN_ROUTE_LABELS[link.route] ?? link.route;
  if (link.type === "internal") {
    const page = pages.find((p) => p.id === link.pageId);
    return page ? `${page.title} (${page.slug})` : `Pagina ${link.pageId}`;
  }
  if (link.type === "external") return link.url;
  if (link.type === "email") return link.email;
  return link.phone;
}
