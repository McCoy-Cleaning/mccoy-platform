/**
 * McCoy brand logo resolution and inline (CID) embedding for transactional mail.
 * Staff invite/reset use CID attachments so Graph/Outlook show the mark reliably.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readServerEnv } from "@mccoy/security";

import { EMAIL_BRAND_LOGO_PATH, resolveEmailBrandLogoUrl } from "./transactional-layout";

/** Content-ID for inline logo attachments (Graph + Nodemailer). */
export const EMAIL_BRAND_LOGO_CID = "mccoy-brand-logo";

export type EmailBrandLogoAttachment = {
  filename: string;
  contentBase64: string;
  contentType: string;
  contentId: string;
};

const PLACEHOLDER_RECIPIENT_NAME_PATTERNS = [
  /^test\s+invitee$/i,
  /^test\s+user$/i,
  /^testgebruiker$/i,
  /^test\s*$/i,
] as const;

/** Resolve logo URL from server env (Graph/SMTP staff mail). */
export function staffEmailBrandLogoUrl(override?: string | null): string {
  if (override?.trim()) return override.trim();
  return resolveEmailBrandLogoUrl({
    explicit: readServerEnv("EMAIL_BRAND_LOGO_URL"),
    storefrontOrigin: readServerEnv("VITE_STOREFRONT_ORIGIN"),
    siteOrigin: readServerEnv("CMS_SITE_ORIGIN"),
    fallbackToProduction: true,
  });
}

function monorepoRootFromModule(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..");
}

function logoFileCandidates(): string[] {
  const root = monorepoRootFromModule();
  const explicit = readServerEnv("EMAIL_BRAND_LOGO_FILE").trim();
  const relative = [
    "apps/storefront/public/images/cms/logo-mccoy.png",
    "apps/storefront/src/assets/logo-mccoy.png",
    "apps/admin/src/assets/logo-mccoy.png",
  ];
  return [
    ...(explicit ? [explicit] : []),
    ...relative.map((segment) => join(root, segment)),
  ];
}

/** Load logo bytes from repo asset paths or EMAIL_BRAND_LOGO_FILE. */
export function loadEmailBrandLogoAttachment(): EmailBrandLogoAttachment | null {
  for (const filePath of logoFileCandidates()) {
    if (!filePath || !existsSync(filePath)) continue;
    try {
      const content = readFileSync(filePath);
      if (content.length === 0) continue;
      return {
        filename: "logo-mccoy.png",
        contentBase64: content.toString("base64"),
        contentType: "image/png",
        contentId: EMAIL_BRAND_LOGO_CID,
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Replace remote logo img src with cid: for inline attachment delivery. */
export function embedBrandLogoCidInHtml(html: string, logoUrl?: string | null): string {
  const cidSrc = `cid:${EMAIL_BRAND_LOGO_CID}`;
  const escapedCid = cidSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const logoPathPattern = EMAIL_BRAND_LOGO_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let out = html;
  if (logoUrl?.trim()) {
    const escapedUrl = logoUrl.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`src="${escapedUrl}"`, "g"), `src="${cidSrc}"`);
  }
  out = out.replace(
    new RegExp(`src="https?:\\/\\/[^"]*${logoPathPattern}"`, "gi"),
    `src="${cidSrc}"`,
  );
  if (!out.includes(`src="${cidSrc}"`)) {
    out = out.replace(/src="[^"]*logo-mccoy\.png[^"]*"/gi, `src="${cidSrc}"`);
  }
  if (!out.includes(`src="${cidSrc}"`)) {
    out = out.replace(new RegExp(`src="${escapedCid}"`, "g"), `src="${cidSrc}"`);
  }
  return out;
}

export type PreparedStaffEmailDelivery = {
  html: string;
  inlineLogo: EmailBrandLogoAttachment | null;
};

/** Prepare staff transactional HTML with optional inline logo for Graph/SMTP. */
export function prepareStaffEmailHtmlForDelivery(
  html: string,
  logoUrl?: string | null,
): PreparedStaffEmailDelivery {
  const inlineLogo = loadEmailBrandLogoAttachment();
  if (!inlineLogo) {
    return { html, inlineLogo: null };
  }
  return {
    html: embedBrandLogoCidInHtml(html, logoUrl),
    inlineLogo,
  };
}

/**
 * Display name for staff invite/reset greetings.
 * Ignores empty values and common test placeholders — never invent a name.
 */
export function resolveStaffEmailRecipientName(name?: string | null): string | null {
  const trimmed = name?.trim() || "";
  if (!trimmed) return null;
  if (PLACEHOLDER_RECIPIENT_NAME_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return null;
  }
  return trimmed;
}

/** Dutch greeting for staff transactional mail. */
export function staffEmailGreeting(name?: string | null): string {
  const resolved = resolveStaffEmailRecipientName(name);
  return resolved ? `Beste ${resolved},` : "Beste uitgenodigde,";
}
