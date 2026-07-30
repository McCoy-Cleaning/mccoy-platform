/**
 * Shared McCoy transactional email layout.
 * Used by staff invites today; Graph/SMTP senders reuse the same HTML/text builders.
 * Keep markup table-based and inline-styled for Outlook/Graph compatibility.
 */

import { escapeHtml } from "./templates";

/** Brand tokens for transactional mail (inline CSS only — no external stylesheets). */
export const EMAIL_BRAND = {
  pageBg: "#f3f5f8",
  cardBg: "#ffffff",
  cardBorder: "#e5e7eb",
  headerBg: "#0b1220",
  accent: "#1e88e5",
  accentHover: "#1976d2",
  text: "#1f2937",
  textMuted: "#6b7280",
  textSoft: "#9ca3af",
  textOnDark: "#ffffff",
  textOnDarkMuted: "#94a3b8",
  brandEyebrow: "#93c5fd",
  securityBg: "#f8fafc",
  securityBorder: "#e2e8f0",
  font: "Segoe UI, Roboto, Helvetica, Arial, sans-serif",
} as const;

/** Public storefront path for the McCoy mark (dark-header friendly). */
export const EMAIL_BRAND_LOGO_PATH = "/images/cms/logo-mccoy.png";

/** Stable production URL for Auth Dashboard templates and offline HTML samples. */
export const EMAIL_BRAND_LOGO_PRODUCTION_URL =
  `https://www.mccoy.nl${EMAIL_BRAND_LOGO_PATH}` as const;

export type EmailBrandLogoInput = {
  /** Absolute override, e.g. EMAIL_BRAND_LOGO_URL */
  explicit?: string | null;
  /** Storefront origin that serves /images/cms/logo-mccoy.png */
  storefrontOrigin?: string | null;
  /** CMS canonical site origin fallback */
  siteOrigin?: string | null;
  /** When origins are missing (Auth template paste), use production mark */
  fallbackToProduction?: boolean;
};

/**
 * Absolute logo URL for Graph/SMTP HTML.
 * Prefer EMAIL_BRAND_LOGO_URL, else storefront/CMS origin + path, else production.
 */
export function resolveEmailBrandLogoUrl(input: EmailBrandLogoInput = {}): string {
  const explicit = input.explicit?.trim();
  if (explicit) return explicit;

  const origin = (input.storefrontOrigin || input.siteOrigin || "").trim().replace(/\/$/, "");
  if (origin) return `${origin}${EMAIL_BRAND_LOGO_PATH}`;

  if (input.fallbackToProduction !== false) {
    return EMAIL_BRAND_LOGO_PRODUCTION_URL;
  }
  return EMAIL_BRAND_LOGO_PRODUCTION_URL;
}

export type TransactionalCta = {
  label: string;
  url: string;
};

export type TransactionalEmailLayoutInput = {
  /** HTML lang attribute */
  lang?: "nl" | "en";
  /** Absolute HTTPS (or cid:) logo URL shown in the dark header */
  logoUrl?: string | null;
  /** Alt text for the logo */
  logoAlt?: string | null;
  /** Small uppercase label above the title (e.g. McCoy Cleaning) */
  brandLabel?: string;
  /** When true and logoUrl is set, hide the text brand eyebrow (logo is enough) */
  hideBrandLabelWhenLogo?: boolean;
  /** Main header title */
  title: string;
  /** Optional subtitle under the title */
  subtitle?: string | null;
  /** Pre-escaped or trusted HTML body (callers must escape user content) */
  bodyHtml: string;
  /** Primary call-to-action */
  cta?: TransactionalCta | null;
  /** Optional secondary note under the CTA (already escaped HTML) */
  afterCtaHtml?: string | null;
  /** Security / legal block (already escaped HTML paragraphs) */
  securityHtml?: string | null;
  /** Footer line under the card */
  footerText?: string | null;
};

/**
 * Professional McCoy card shell for Graph, SMTP, and Auth-template reuse.
 * Body/CTA/security HTML must already be escaped where it includes user input.
 */
export function renderTransactionalEmailHtml(input: TransactionalEmailLayoutInput): string {
  const lang = input.lang ?? "nl";
  const brandLabelText = input.brandLabel ?? "McCoy Cleaning";
  const brandLabel = escapeHtml(brandLabelText);
  const title = escapeHtml(input.title);
  const logoUrl = input.logoUrl?.trim() || null;
  const logoAlt = escapeHtml(input.logoAlt?.trim() || brandLabelText);
  const hideBrandLabel = Boolean(logoUrl) && input.hideBrandLabelWhenLogo !== false;

  const logoHtml = logoUrl
    ? `
                <div style="margin:0 0 ${hideBrandLabel ? "16px" : "12px"};">
                  <img src="${escapeHtml(logoUrl)}" alt="${logoAlt}" width="168" height="auto" style="display:block;width:168px;max-width:70%;height:auto;border:0;outline:none;text-decoration:none;" />
                </div>`
    : "";

  const brandEyebrow = hideBrandLabel
    ? ""
    : `<div style="color:${EMAIL_BRAND.brandEyebrow};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">${brandLabel}</div>`;

  const subtitle = input.subtitle?.trim()
    ? `<div style="color:${EMAIL_BRAND.textOnDarkMuted};font-size:13px;line-height:1.5;margin-top:8px;">${escapeHtml(input.subtitle.trim())}</div>`
    : "";

  const cta = input.cta
    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">
                  <tr>
                    <td align="center" bgcolor="${EMAIL_BRAND.accent}" style="border-radius:10px;background-color:${EMAIL_BRAND.accent};">
                      <a href="${escapeHtml(input.cta.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;color:${EMAIL_BRAND.textOnDark};font-size:14px;font-weight:700;line-height:1.2;text-decoration:none;border-radius:10px;">
                        ${escapeHtml(input.cta.label)}
                      </a>
                    </td>
                  </tr>
                </table>`
    : "";

  const afterCta = input.afterCtaHtml?.trim()
    ? `<div style="margin:16px 0 0;color:${EMAIL_BRAND.textMuted};font-size:12px;line-height:1.55;">${input.afterCtaHtml}</div>`
    : "";

  const security = input.securityHtml?.trim()
    ? `
            <tr>
              <td style="padding:0 32px 28px;">
                <div style="background:${EMAIL_BRAND.securityBg};border:1px solid ${EMAIL_BRAND.securityBorder};border-radius:12px;padding:16px 18px;color:${EMAIL_BRAND.textMuted};font-size:12px;line-height:1.55;">
                  ${input.securityHtml}
                </div>
              </td>
            </tr>`
    : "";

  const footer = input.footerText?.trim()
    ? `<p style="margin:20px 0 0;color:${EMAIL_BRAND.textSoft};font-size:11px;line-height:1.5;">${escapeHtml(input.footerText.trim())}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBg};font-family:${EMAIL_BRAND.font};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_BRAND.pageBg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${EMAIL_BRAND.cardBg};border-radius:16px;overflow:hidden;border:1px solid ${EMAIL_BRAND.cardBorder};">
            <tr>
              <td style="background:${EMAIL_BRAND.headerBg};padding:28px 32px;">
                ${logoHtml}
                ${brandEyebrow}
                <div style="color:${EMAIL_BRAND.textOnDark};font-size:24px;font-weight:700;margin-top:${logoHtml ? "4px" : hideBrandLabel ? "0" : "10px"};letter-spacing:-0.02em;line-height:1.25;">${title}</div>
                ${subtitle}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;color:${EMAIL_BRAND.text};font-size:15px;line-height:1.65;">
                ${input.bodyHtml}
                ${cta}
                ${afterCta}
              </td>
            </tr>
            ${security}
          </table>
          ${footer}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Plain-text companion for multipart Graph/SMTP sends. */
export function renderTransactionalEmailText(parts: {
  title: string;
  greeting?: string | null;
  paragraphs: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  securityLines?: string[];
  footer?: string | null;
}): string {
  const lines: string[] = [parts.title, ""];
  if (parts.greeting?.trim()) {
    lines.push(parts.greeting.trim(), "");
  }
  for (const paragraph of parts.paragraphs) {
    const trimmed = paragraph.trim();
    if (trimmed) lines.push(trimmed, "");
  }
  if (parts.ctaUrl?.trim()) {
    lines.push(`${parts.ctaLabel?.trim() || "Link"}: ${parts.ctaUrl.trim()}`, "");
  }
  if (parts.securityLines?.length) {
    lines.push("Beveiliging:");
    for (const line of parts.securityLines) {
      lines.push(`- ${line}`);
    }
    lines.push("");
  }
  if (parts.footer?.trim()) {
    lines.push(parts.footer.trim());
  }
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatEmailDateNl(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}
