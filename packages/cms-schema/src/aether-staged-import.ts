/**
 * Map Aether staged-fix dumps onto McCoy CMS locale drafts.
 * URL -> page (slug /services, /contact, /en/..., page_services, locale nl/en).
 * kind title|meta_description|h1 -> seo.title / seo.description / pageTitle.
 * Never maps canonical / schema / internal_link.
 */

import type { CmsPage } from "./types";
import type { Locale } from "./locale";
import { ensurePageLocaleFields } from "./migrate-locale";
import { canonicalizePublicIdentityPath, stripLocalePrefix } from "./paths";

export const AETHER_APPLYABLE_KINDS = ["title", "meta_description", "h1"] as const;
export type AetherApplyableKind = (typeof AETHER_APPLYABLE_KINDS)[number];

export const FROZEN_LIVE_TITLE_NOTE =
  "frozen_live_title: CMS seo.title is a draft only. Live www.mccoy.nl head uses a frozen deployed-title overlay (SEO-7 != SEO-8) until McCoy admin publish+freeze.";

export type AetherBuiltinPage = { pageId: string; pageKey: string; nl: string; en: string };

export const AETHER_BUILTIN_PAGES: readonly AetherBuiltinPage[] = [
  { pageId: "page_home", pageKey: "home", nl: "/", en: "/en" },
  { pageId: "page_about", pageKey: "about", nl: "/about", en: "/en/about" },
  { pageId: "page_services", pageKey: "services", nl: "/services", en: "/en/services" },
  { pageId: "page_products", pageKey: "products", nl: "/products", en: "/en/products" },
  { pageId: "page_contact", pageKey: "contact", nl: "/contact", en: "/en/contact" },
  { pageId: "page_vacatures", pageKey: "vacatures", nl: "/vacatures", en: "/en/vacatures" },
  { pageId: "page_offerte", pageKey: "offerte", nl: "/offerte", en: "/en/offerte" },
];

export type AetherLocalePatch = { seo?: { title?: string; description?: string }; pageTitle?: string };

export type AetherResolvedPage = { pageId: string; pageKey: string; locale: Locale; path: string; identityPath: string };

export type AetherDumpPatch = { id?: string; status?: string; pageUrl: string; kind: string; currentValue?: string | null; proposedValue: string; urlIdentityKey?: string };

export type AetherStagedFixesDump = { version?: number; source?: string; siteId?: string; exportedAt?: string; notice?: string; importHint?: string; patches: AetherDumpPatch[] };

function identityOf(pathname: string): string {
  return canonicalizePublicIdentityPath(pathname.replace(/\/+$/, "") || "/");
}

export function normalizeAetherPageUrl(raw: string): { locale: Locale; path: string; identityPath: string } {
  let pathname = raw.trim();
  try {
    const u = new URL(pathname.includes("://") ? pathname : "https://www.mccoy.nl" + (pathname.startsWith("/") ? pathname : "/" + pathname));
    pathname = u.pathname || "/";
  } catch {
    if (!pathname.startsWith("/")) pathname = "/" + pathname;
  }
  const stripped = stripLocalePrefix(pathname);
  const identity = identityOf(stripped.path);
  const path = stripped.locale === "en" ? (identity === "/" ? "/en" : "/en" + identity) : identity;
  return { locale: stripped.locale, path, identityPath: identity };
}

export function resolveCmsPageFromUrl(pageUrl: string, extraPages: readonly AetherBuiltinPage[] = []): AetherResolvedPage | null {
  const { locale, path, identityPath } = normalizeAetherPageUrl(pageUrl);
  const catalog = [...AETHER_BUILTIN_PAGES, ...extraPages];
  const hit = catalog.find((p) => identityOf(p.nl) === identityPath || identityOf(p.en.replace(/^\/en(?=\/|$)/, "") || "/") === identityPath);
  if (!hit) {
    const slug = identityPath === "/" ? "home" : identityPath.replace(/^\//, "");
    return { pageId: "page_" + slug.replace(/[^a-z0-9_-]/gi, "_"), pageKey: slug, locale, path, identityPath };
  }
  return { pageId: hit.pageId, pageKey: hit.pageKey, locale, path: locale === "en" ? hit.en : hit.nl, identityPath };
}

export function mapKindToLocalePatch(kind: string, proposedValue: string): { skipReason?: string; cmsField: string | null; localePatch: AetherLocalePatch; frozenLiveTitle: boolean } {
  if (kind === "canonical") return { skipReason: "canonical_not_in_mccoy_cms", cmsField: null, localePatch: {}, frozenLiveTitle: false };
  if (kind === "schema_jsonld") return { skipReason: "schema_not_in_mccoy_cms", cmsField: null, localePatch: {}, frozenLiveTitle: false };
  if (kind === "internal_link") return { skipReason: "internal_link_not_in_mccoy_cms", cmsField: null, localePatch: {}, frozenLiveTitle: false };
  if (kind === "title") return { cmsField: "seo.title", localePatch: { seo: { title: proposedValue } }, frozenLiveTitle: true };
  if (kind === "meta_description") return { cmsField: "seo.description", localePatch: { seo: { description: proposedValue } }, frozenLiveTitle: false };
  if (kind === "h1") return { cmsField: "pageTitle", localePatch: { pageTitle: proposedValue }, frozenLiveTitle: false };
  return { skipReason: "kind_not_applyable", cmsField: null, localePatch: {}, frozenLiveTitle: false };
}

export function applyAetherLocalePatch(page: CmsPage, locale: Locale, patch: AetherLocalePatch): CmsPage {
  const ensured = ensurePageLocaleFields(page);
  const prev = ensured.localeContent?.[locale] ?? ensured.localeContent!.nl;
  const nextLocale = {
    navigationLabel: prev.navigationLabel,
    pageTitle: patch.pageTitle ?? prev.pageTitle,
    seo: { ...prev.seo, title: patch.seo?.title ?? prev.seo.title, description: patch.seo?.description ?? prev.seo.description },
  };
  const next: CmsPage = { ...ensured, localeContent: { ...ensured.localeContent!, [locale]: nextLocale } };
  return ensurePageLocaleFields(next);
}

export function currentValueForCmsField(page: CmsPage | null, locale: Locale, cmsField: string | null, fallback: string | null = null): string | null {
  if (!page || !cmsField) return fallback;
  const bag = page.localeContent?.[locale];
  if (cmsField === "seo.title") return bag?.seo?.title ?? fallback;
  if (cmsField === "seo.description") return bag?.seo?.description ?? fallback;
  if (cmsField === "pageTitle") return bag?.pageTitle ?? fallback;
  return fallback;
}

export function parseAetherStagedFixesDump(raw: unknown): AetherStagedFixesDump {
  if (!raw || typeof raw !== "object") throw new Error("aether dump: expected object");
  const rec = raw as Record<string, unknown>;
  const patches = Array.isArray(rec.patches) ? rec.patches : Array.isArray(rec.fixes) ? rec.fixes : [];
  const mapped: AetherDumpPatch[] = [];
  for (const item of patches) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const pageUrl = typeof p.pageUrl === "string" ? p.pageUrl : typeof p.url === "string" ? p.url : "";
    const kind = typeof p.kind === "string" ? p.kind : "";
    const proposedValue = typeof p.proposedValue === "string" ? p.proposedValue : "";
    if (!pageUrl || !kind || !proposedValue) continue;
    mapped.push({ id: typeof p.id === "string" ? p.id : undefined, status: typeof p.status === "string" ? p.status : undefined, pageUrl, kind, currentValue: typeof p.currentValue === "string" ? p.currentValue : p.currentValue === null ? null : undefined, proposedValue, urlIdentityKey: typeof p.urlIdentityKey === "string" ? p.urlIdentityKey : undefined });
  }
  return { version: 1, source: typeof rec.source === "string" ? rec.source : "aether-crawler", siteId: typeof rec.siteId === "string" ? rec.siteId : undefined, exportedAt: typeof rec.exportedAt === "string" ? rec.exportedAt : undefined, notice: typeof rec.notice === "string" ? rec.notice : undefined, importHint: typeof rec.importHint === "string" ? rec.importHint : undefined, patches: mapped };
}
