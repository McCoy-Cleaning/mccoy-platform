import { z } from "zod";
import { cmsImageSchema, cmsButtonSchema, createItemId, type CmsImage, type CmsButton } from "./content";
import { cmsLinkSchema } from "./links";
import type { CmsLink } from "./cms-link-model";

export type SiteNavLink = {
  id: string;
  label: string;
  link: CmsLink;
};

/** Defaults match current storefront chrome (desktop ~lg logo, mobile menu logo). */
export const DEFAULT_LOGO_HEIGHT_DESKTOP_PX = 72;
export const DEFAULT_LOGO_HEIGHT_MOBILE_PX = 32;
export const LOGO_HEIGHT_DESKTOP_MIN = 28;
export const LOGO_HEIGHT_DESKTOP_MAX = 140;
export const LOGO_HEIGHT_MOBILE_MIN = 20;
export const LOGO_HEIGHT_MOBILE_MAX = 72;

export type SiteNavigationContent = {
  logo?: CmsImage;
  /** Logo height in the desktop top bar (px). */
  logoHeightDesktop?: number;
  /** Logo height in the mobile / tablet menu header (px). */
  logoHeightMobile?: number;
  links: SiteNavLink[];
  /** Secondary CTA (e.g. Vacatures) — desktop + mobile. */
  jobsCta?: CmsButton;
  /** Primary CTA (e.g. Offerte). */
  quoteCta?: CmsButton;
};

const siteNavLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  link: cmsLinkSchema,
});

export const siteNavigationContentSchema: z.ZodType<SiteNavigationContent> = z.object({
  logo: cmsImageSchema.optional(),
  logoHeightDesktop: z.number().int().min(LOGO_HEIGHT_DESKTOP_MIN).max(LOGO_HEIGHT_DESKTOP_MAX).optional(),
  logoHeightMobile: z.number().int().min(LOGO_HEIGHT_MOBILE_MIN).max(LOGO_HEIGHT_MOBILE_MAX).optional(),
  links: z.array(siteNavLinkSchema),
  jobsCta: cmsButtonSchema.optional(),
  quoteCta: cmsButtonSchema.optional(),
});

export function clampLogoHeightDesktop(px: number): number {
  return Math.min(LOGO_HEIGHT_DESKTOP_MAX, Math.max(LOGO_HEIGHT_DESKTOP_MIN, Math.round(px)));
}

export function clampLogoHeightMobile(px: number): number {
  return Math.min(LOGO_HEIGHT_MOBILE_MAX, Math.max(LOGO_HEIGHT_MOBILE_MIN, Math.round(px)));
}

export function resolveLogoHeightDesktop(nav: SiteNavigationContent): number {
  return clampLogoHeightDesktop(nav.logoHeightDesktop ?? DEFAULT_LOGO_HEIGHT_DESKTOP_PX);
}

export function resolveLogoHeightMobile(nav: SiteNavigationContent): number {
  return clampLogoHeightMobile(nav.logoHeightMobile ?? DEFAULT_LOGO_HEIGHT_MOBILE_PX);
}

export function defaultSiteNavigation(): SiteNavigationContent {
  return {
    logoHeightDesktop: DEFAULT_LOGO_HEIGHT_DESKTOP_PX,
    logoHeightMobile: DEFAULT_LOGO_HEIGHT_MOBILE_PX,
    links: [
      { id: "nav_home", label: "Home", link: { type: "internal_route", route: "home" } },
      { id: "nav_services", label: "Diensten", link: { type: "internal_route", route: "services" } },
      { id: "nav_products", label: "Producten", link: { type: "internal_route", route: "products" } },
      { id: "nav_about", label: "Over ons", link: { type: "internal_route", route: "about" } },
      { id: "nav_contact", label: "Contact", link: { type: "internal_route", route: "contact" } },
    ],
    jobsCta: {
      label: "Vacatures",
      link: { type: "internal_route", route: "vacatures" },
    },
    quoteCta: {
      label: "Vraag een offerte aan",
      link: { type: "internal_route", route: "offerte" },
    },
  };
}

export function parseSiteNavigation(value: unknown): SiteNavigationContent | null {
  const parsed = siteNavigationContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Like parseSiteNavigation but returns a Dutch validation reason on failure. */
export function parseSiteNavigationResult(
  value: unknown,
): { ok: true; data: SiteNavigationContent } | { ok: false; reason: string } {
  const parsed = siteNavigationContentSchema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const path = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
  return {
    ok: false,
    reason: `Ongeldige navigatie-inhoud${path}: ${issue?.message ?? "validatie mislukt"}.`,
  };
}

export function mergeNavigationPatch(
  base: SiteNavigationContent,
  patch: Partial<{ [K in keyof SiteNavigationContent]: SiteNavigationContent[K] | null }>,
): SiteNavigationContent {
  const out: SiteNavigationContent = {
    ...base,
    links: [...base.links],
  };
  for (const [k, v] of Object.entries(patch) as Array<
    [keyof SiteNavigationContent, SiteNavigationContent[keyof SiteNavigationContent] | null | undefined]
  >) {
    if (v === undefined) continue;
    if (v === null) {
      if (k === "logo" || k === "jobsCta" || k === "quoteCta") {
        delete out[k];
      }
      continue;
    }
    if (k === "links" && Array.isArray(v)) {
      out.links = v as SiteNavLink[];
      continue;
    }
    if (k === "logoHeightDesktop" && typeof v === "number") {
      out.logoHeightDesktop = clampLogoHeightDesktop(v);
      continue;
    }
    if (k === "logoHeightMobile" && typeof v === "number") {
      out.logoHeightMobile = clampLogoHeightMobile(v);
      continue;
    }
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function createNavLink(partial?: Partial<SiteNavLink>): SiteNavLink {
  return {
    id: createItemId("nav"),
    label: partial?.label ?? "Nieuwe link",
    link: partial?.link ?? { type: "internal_route", route: "home" },
  };
}

export function effectiveSiteNavigation(
  published: SiteNavigationContent | undefined,
  draft: SiteNavigationContent | null | undefined,
): SiteNavigationContent {
  if (draft) return structuredClone(draft);
  if (published) return structuredClone(published);
  return defaultSiteNavigation();
}

export function isNavigationDraftDirty(
  published: SiteNavigationContent | undefined,
  draft: SiteNavigationContent | null | undefined,
): boolean {
  if (draft == null) return false;
  return JSON.stringify(draft) !== JSON.stringify(published ?? defaultSiteNavigation());
}

/** Built-in McCoy mark used when CMS has no custom logo. */
export const DEFAULT_NAV_LOGO: CmsImage = {
  assetId: "local:images/cms/logo-mccoy.png",
  src: "/images/cms/logo-mccoy.png",
  alt: "McCoy Cleaning",
  decorative: true,
};
