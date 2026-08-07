import { z } from "zod";
import { cmsImageSchema, type CmsImage } from "./cms-image";
import { createItemId } from "./ids";
import { cmsLinkSchema } from "./links";
import type { CmsLink } from "./cms-link-model";
import { DEFAULT_NAV_LOGO } from "./navigation";

export type SiteFooterLink = {
  id: string;
  label: string;
  link: CmsLink;
};

export type SiteFooterSocialNetwork = "facebook" | "instagram" | "linkedin" | "other";

export type SiteFooterSocialLink = {
  id: string;
  network: SiteFooterSocialNetwork;
  href: string;
  label: string;
};

export type SiteFooterContactKind = "address" | "phone" | "email" | "text";

export type SiteFooterContactRow = {
  id: string;
  kind: SiteFooterContactKind;
  label: string;
  /** Optional tel:/mailto:/https: target for phone, email, or linked text. */
  href?: string;
};

export type SiteFooterContent = {
  logo?: CmsImage;
  /** Footer logo display height on desktop (px). */
  logoHeight?: number;
  /** Footer logo display height on mobile (px). */
  logoHeightMobile?: number;
  tagline: string;
  socialLinks: SiteFooterSocialLink[];
  servicesTitle: string;
  servicesLinks: SiteFooterLink[];
  contactTitle: string;
  contactRows: SiteFooterContactRow[];
  certsTitle: string;
  certs: string[];
  extraLinks: SiteFooterLink[];
  copyright: string;
  legalLinks: SiteFooterLink[];
};

export const DEFAULT_FOOTER_LOGO_HEIGHT_PX = 40;
export const DEFAULT_FOOTER_LOGO_HEIGHT_MOBILE_PX = 32;
export const FOOTER_LOGO_HEIGHT_MIN = 24;
export const FOOTER_LOGO_HEIGHT_MAX = 96;
export const FOOTER_LOGO_HEIGHT_MOBILE_MIN = 20;
export const FOOTER_LOGO_HEIGHT_MOBILE_MAX = 72;

export function clampFooterLogoHeight(px: number): number {
  return Math.min(FOOTER_LOGO_HEIGHT_MAX, Math.max(FOOTER_LOGO_HEIGHT_MIN, Math.round(px)));
}

export function clampFooterLogoHeightMobile(px: number): number {
  return Math.min(
    FOOTER_LOGO_HEIGHT_MOBILE_MAX,
    Math.max(FOOTER_LOGO_HEIGHT_MOBILE_MIN, Math.round(px)),
  );
}

export function resolveFooterLogoHeight(footer: SiteFooterContent): number {
  return clampFooterLogoHeight(footer.logoHeight ?? DEFAULT_FOOTER_LOGO_HEIGHT_PX);
}

export function resolveFooterLogoHeightMobile(footer: SiteFooterContent): number {
  return clampFooterLogoHeightMobile(
    footer.logoHeightMobile ?? DEFAULT_FOOTER_LOGO_HEIGHT_MOBILE_PX,
  );
}

const siteFooterLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  link: cmsLinkSchema,
});

const siteFooterSocialLinkSchema = z.object({
  id: z.string().min(1),
  network: z.enum(["facebook", "instagram", "linkedin", "other"]),
  href: z.string(),
  label: z.string(),
});

const siteFooterContactRowSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["address", "phone", "email", "text"]),
  label: z.string(),
  href: z.string().optional(),
});

export const siteFooterContentSchema: z.ZodType<SiteFooterContent> = z.object({
  logo: cmsImageSchema.optional(),
  logoHeight: z
    .number()
    .int()
    .min(FOOTER_LOGO_HEIGHT_MIN)
    .max(FOOTER_LOGO_HEIGHT_MAX)
    .optional(),
  logoHeightMobile: z
    .number()
    .int()
    .min(FOOTER_LOGO_HEIGHT_MOBILE_MIN)
    .max(FOOTER_LOGO_HEIGHT_MOBILE_MAX)
    .optional(),
  tagline: z.string(),
  socialLinks: z.array(siteFooterSocialLinkSchema),
  servicesTitle: z.string(),
  servicesLinks: z.array(siteFooterLinkSchema),
  contactTitle: z.string(),
  contactRows: z.array(siteFooterContactRowSchema),
  certsTitle: z.string(),
  certs: z.array(z.string()),
  extraLinks: z.array(siteFooterLinkSchema),
  copyright: z.string(),
  legalLinks: z.array(siteFooterLinkSchema),
});

/** Defaults match the current storefront Footer chrome (NL). */
export function defaultSiteFooter(): SiteFooterContent {
  return {
    logoHeight: DEFAULT_FOOTER_LOGO_HEIGHT_PX,
    logoHeightMobile: DEFAULT_FOOTER_LOGO_HEIGHT_MOBILE_PX,
    tagline: "Schoonmaak met karakter — zichtbare kwaliteit sinds 1998.",
    socialLinks: [
      {
        id: "footer_social_fb",
        network: "facebook",
        href: "https://www.facebook.com/McCoyCleaning/",
        label: "Facebook",
      },
      {
        id: "footer_social_ig",
        network: "instagram",
        href: "https://www.instagram.com/mccoycleaning/",
        label: "Instagram",
      },
      {
        id: "footer_social_li",
        network: "linkedin",
        href: "",
        label: "LinkedIn",
      },
    ],
    servicesTitle: "Diensten",
    servicesLinks: [
      {
        id: "footer_svc_1",
        label: "Reguliere schoonmaak",
        link: { type: "internal_route", route: "services" },
      },
      {
        id: "footer_svc_2",
        label: "Horeca schoonmaak",
        link: { type: "internal_route", route: "services" },
      },
      {
        id: "footer_svc_3",
        label: "Opleveringsschoonmaak",
        link: { type: "internal_route", route: "services" },
      },
      {
        id: "footer_svc_4",
        label: "Vloeronderhoud",
        link: { type: "internal_route", route: "services" },
      },
      {
        id: "footer_svc_5",
        label: "Meubelreiniging",
        link: { type: "internal_route", route: "services" },
      },
      {
        id: "footer_svc_6",
        label: "Glas- & gevelreiniging",
        link: { type: "internal_route", route: "services" },
      },
    ],
    contactTitle: "Contact",
    contactRows: [
      {
        id: "footer_contact_addr",
        kind: "address",
        label: "Nijverheidsstraat 63, 7575 BH Oldenzaal",
      },
      {
        id: "footer_contact_phone",
        kind: "phone",
        label: "0541 534 982",
        href: "tel:+31541534982",
      },
      {
        id: "footer_contact_email",
        kind: "email",
        label: "info@mccoy.nl",
        href: "mailto:info@mccoy.nl",
      },
    ],
    certsTitle: "Keurmerken",
    certs: ["OSB", "VSR", "Code Verantwoordelijk Marktgedrag"],
    extraLinks: [
      {
        id: "footer_extra_products",
        label: "Producten",
        link: { type: "internal_route", route: "products" },
      },
      {
        id: "footer_extra_jobs",
        label: "Vacatures",
        link: { type: "internal_route", route: "vacatures" },
      },
    ],
    copyright: "© 2026 McCoy Cleaning — Schoonmaak met karakter.",
    legalLinks: [
      {
        id: "footer_legal_terms",
        label: "Algemene voorwaarden",
        link: { type: "internal_route", route: "terms" },
      },
      {
        id: "footer_legal_privacy",
        label: "Privacyverklaring",
        link: { type: "internal_route", route: "privacy" },
      },
    ],
  };
}

export function parseSiteFooter(value: unknown): SiteFooterContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = siteFooterContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseSiteFooterResult(
  value: unknown,
): { ok: true; data: SiteFooterContent } | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "Ongeldige footer-inhoud: verwacht een object." };
  }
  const parsed = siteFooterContentSchema.safeParse(value);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  const path = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
  return {
    ok: false,
    reason: `Ongeldige footer-inhoud${path}: ${issue?.message ?? "validatie mislukt"}.`,
  };
}

export function mergeFooterPatch(
  base: SiteFooterContent,
  patch: Partial<{ [K in keyof SiteFooterContent]: SiteFooterContent[K] | null }>,
): SiteFooterContent {
  const out: SiteFooterContent = {
    ...base,
    socialLinks: [...base.socialLinks],
    servicesLinks: [...base.servicesLinks],
    contactRows: [...base.contactRows],
    certs: [...base.certs],
    extraLinks: [...base.extraLinks],
    legalLinks: [...base.legalLinks],
  };
  for (const [k, v] of Object.entries(patch) as Array<
    [keyof SiteFooterContent, SiteFooterContent[keyof SiteFooterContent] | null | undefined]
  >) {
    if (v === undefined) continue;
    if (v === null) {
      if (k === "logo") delete out.logo;
      continue;
    }
    if (k === "logoHeight" && typeof v === "number") {
      out.logoHeight = clampFooterLogoHeight(v);
      continue;
    }
    if (k === "logoHeightMobile" && typeof v === "number") {
      out.logoHeightMobile = clampFooterLogoHeightMobile(v);
      continue;
    }
    (out as Record<string, unknown>)[k] = Array.isArray(v) ? [...v] : v;
  }
  return out;
}

export function createFooterLink(partial?: Partial<SiteFooterLink>): SiteFooterLink {
  return {
    id: createItemId("footer"),
    label: partial?.label ?? "Nieuwe link",
    link: partial?.link ?? { type: "internal_route", route: "home" },
  };
}

export function createFooterSocialLink(
  partial?: Partial<SiteFooterSocialLink>,
): SiteFooterSocialLink {
  return {
    id: createItemId("footer_social"),
    network: partial?.network ?? "other",
    href: partial?.href ?? "",
    label: partial?.label ?? "Social",
  };
}

export function createFooterContactRow(
  partial?: Partial<SiteFooterContactRow>,
): SiteFooterContactRow {
  return {
    id: createItemId("footer_contact"),
    kind: partial?.kind ?? "text",
    label: partial?.label ?? "Contactregel",
    ...(partial?.href ? { href: partial.href } : {}),
  };
}

export function effectiveSiteFooter(
  published: SiteFooterContent | undefined,
  draft: SiteFooterContent | null | undefined,
): SiteFooterContent {
  if (draft) return structuredClone(draft);
  if (published) return structuredClone(published);
  return defaultSiteFooter();
}

export function isFooterDraftDirty(
  published: SiteFooterContent | undefined,
  draft: SiteFooterContent | null | undefined,
): boolean {
  if (draft == null) return false;
  return JSON.stringify(draft) !== JSON.stringify(published ?? defaultSiteFooter());
}

/** Built-in McCoy mark when CMS has no custom footer logo. */
export const DEFAULT_FOOTER_LOGO: CmsImage = DEFAULT_NAV_LOGO;
