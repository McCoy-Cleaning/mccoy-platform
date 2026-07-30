import { readServerEnv } from "@mccoy/security";

import { shouldAttemptGraphMail } from "./form-inbox-provider";
import { sendGraphAdminReply } from "./graph-mail";
import {
  defaultTransactionalFrom,
  isSmtpConfigured,
  isSmtpUsableForOutbound,
  sendSmtpMail,
} from "./smtp";
import { escapeHtml } from "./templates";
import {
  EMAIL_BRAND_LOGO_PRODUCTION_URL,
  formatEmailDateNl,
  resolveEmailBrandLogoUrl,
  renderTransactionalEmailHtml,
  renderTransactionalEmailText,
} from "./transactional-layout";

export type StaffInviteEmailInput = {
  to: string;
  /**
   * Absolute invite/action URL.
   * For Supabase Auth Dashboard templates, pass `{{ .ConfirmationURL }}`
   * (placeholders are left intact by HTML escaping).
   */
  inviteUrl: string;
  invitedByName?: string | null;
  invitedByEmail?: string | null;
  inviteeFullName?: string | null;
  expiresAt?: string | null;
  /**
   * Absolute logo URL override. Defaults to EMAIL_BRAND_LOGO_URL or
   * storefront `/images/cms/logo-mccoy.png` (Graph/SMTP reuse the same mark).
   */
  logoUrl?: string | null;
};

function staffInviteLogoUrl(override?: string | null): string {
  if (override?.trim()) return override.trim();
  return resolveEmailBrandLogoUrl({
    explicit: readServerEnv("EMAIL_BRAND_LOGO_URL"),
    storefrontOrigin: readServerEnv("VITE_STOREFRONT_ORIGIN"),
    siteOrigin: readServerEnv("CMS_SITE_ORIGIN"),
    fallbackToProduction: true,
  });
}

/**
 * Branded Dutch staff-invite email (admin role only).
 * Same HTML/text is used for Graph and SMTP — do not fork markup per transport.
 * CTA uses the Auth Admin action_link (or Supabase ConfirmationURL) — never secrets in the body.
 */
export function buildStaffInviteEmail(input: StaffInviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const invitee = input.inviteeFullName?.trim() || null;
  const inviter =
    input.invitedByName?.trim() ||
    input.invitedByEmail?.trim() ||
    "een McCoy superbeheerder";
  const expiryLabel = formatEmailDateNl(input.expiresAt);
  const greeting = invitee ? `Beste ${invitee},` : "Beste collega,";
  const subject = "Uitnodiging voor McCoy Admin";
  const logoUrl = staffInviteLogoUrl(input.logoUrl);

  const steps = [
    "Stel een sterk wachtwoord in (en bevestig het)",
    invitee ? null : "Vul je naam in als die nog ontbreekt",
    "Activeer verplichte tweestapsverificatie (TOTP)",
  ].filter((step): step is string => Boolean(step));

  const stepsHtml = `
    <p style="margin:0 0 10px;color:#374151;font-size:14px;font-weight:600;">Na acceptatie doorloop je:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
      ${steps
        .map(
          (step, index) => `
      <tr>
        <td style="padding:6px 0;vertical-align:top;width:28px;">
          <div style="width:22px;height:22px;border-radius:999px;background:#e8f3fc;color:#1e88e5;font-size:12px;font-weight:700;line-height:22px;text-align:center;">${index + 1}</div>
        </td>
        <td style="padding:6px 0 6px 8px;color:#374151;font-size:14px;line-height:1.45;">${escapeHtml(step)}</td>
      </tr>`,
        )
        .join("")}
    </table>`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;">
      <strong style="color:#111827;">${escapeHtml(inviter)}</strong> nodigt je uit als
      <strong style="color:#111827;">beheerder</strong> in McCoy Admin.
    </p>
    <p style="margin:0 0 16px;color:#4b5563;">
      Je krijgt toegang tot het McCoy control center. Volledige toegang volgt pas na
      wachtwoordinstelling en tweestapsverificatie.
    </p>
    ${stepsHtml}
    ${
      expiryLabel
        ? `<p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Deze uitnodiging is geldig tot <strong style="color:#111827;">${escapeHtml(expiryLabel)}</strong>.</p>`
        : ""
    }`;

  const afterCtaHtml = `
    <p style="margin:0 0 8px;">Werkt de knop niet? Kopieer deze link naar je browser:</p>
    <p style="margin:0;color:#1e88e5;word-break:break-all;">${escapeHtml(input.inviteUrl)}</p>`;

  const securityHtml = `
    <strong style="display:block;color:#111827;font-size:12px;margin-bottom:6px;">Beveiliging</strong>
    Negeer dit bericht als je geen uitnodiging verwachtte. Deel de link met niemand.
    McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.`;

  const html = renderTransactionalEmailHtml({
    lang: "nl",
    logoUrl,
    logoAlt: "McCoy Cleaning",
    brandLabel: "McCoy Cleaning",
    title: "Admin-uitnodiging",
    subtitle: "Beveiligde toegang tot het McCoy control center",
    bodyHtml,
    cta: {
      label: "Uitnodiging accepteren",
      url: input.inviteUrl,
    },
    afterCtaHtml,
    securityHtml,
    footerText: "McCoy Cleaning · Vertrouwelijk · Alleen bedoeld voor de uitgenodigde ontvanger",
  });

  const text = renderTransactionalEmailText({
    title: "McCoy Cleaning — Admin-uitnodiging",
    greeting,
    paragraphs: [
      `${inviter} nodigt je uit voor toegang tot het McCoy Admin-panel als beheerder.`,
      "Na acceptatie doorloop je:",
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      expiryLabel ? `Deze uitnodiging is geldig tot ${expiryLabel}.` : "",
    ],
    ctaLabel: "Uitnodiging accepteren",
    ctaUrl: input.inviteUrl,
    securityLines: [
      "Negeer deze e-mail als je geen uitnodiging verwachtte.",
      "Deel deze link met niemand.",
      "McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.",
    ],
    footer: "— McCoy Cleaning · Vertrouwelijk",
  });

  return { subject, html, text };
}

/**
 * HTML/subject for Supabase Dashboard → Authentication → Email Templates → Invite user.
 * Uses `{{ .ConfirmationURL }}` so the same professional layout works as Auth fallback
 * until Graph Mail.Send (or usable SMTP) delivers branded mail directly.
 */
export function buildStaffInviteSupabaseAuthTemplate(): {
  subject: string;
  html: string;
} {
  const built = buildStaffInviteEmail({
    to: "",
    inviteUrl: "{{ .ConfirmationURL }}",
    invitedByName: null,
    invitedByEmail: null,
    inviteeFullName: null,
    expiresAt: null,
    logoUrl: EMAIL_BRAND_LOGO_PRODUCTION_URL,
  });
  return { subject: built.subject, html: built.html };
}

export type StaffInviteDelivery = "graph" | "smtp";

export type SendStaffInviteEmailResult =
  | { ok: true; messageId?: string; delivery: StaffInviteDelivery }
  | { ok: false; error: string; code: "config" | "provider" };

/** True when Graph is configured or non-M365 SMTP can send branded staff invites. */
export function isStaffInviteEmailConfigured(): boolean {
  return shouldAttemptGraphMail() || isSmtpUsableForOutbound();
}

/**
 * Whether invites should try generateLink + branded HTML *before* Supabase Auth mail.
 *
 * Graph inbox credentials alone must NOT prefer branded-first: generateLink creates the
 * Auth user without sending mail, and inviteUserByEmail then fails ("already registered")
 * when Graph lacks Mail.Send — the invitee receives nothing.
 *
 * Prefer branded-first only when SMTP is known-usable, or when
 * STAFF_INVITE_BRANDED_FIRST=1 after Graph Mail.Send is confirmed.
 */
export function shouldPreferBrandedStaffInviteFirst(): boolean {
  if (readServerEnv("STAFF_INVITE_BRANDED_FIRST").trim() === "1") {
    return isStaffInviteEmailConfigured();
  }
  return isSmtpUsableForOutbound();
}

/**
 * Send branded invite via Microsoft Graph (preferred on M365) or usable SMTP.
 * Uses {@link buildStaffInviteEmail} — one template for both transports.
 * Callers should keep Supabase inviteUserByEmail as fallback when this fails.
 */
export async function sendStaffInviteEmail(
  input: StaffInviteEmailInput,
): Promise<SendStaffInviteEmailResult> {
  if (process.env.MCCOY_E2E === "1") {
    return { ok: true, messageId: `e2e-invite-${Date.now()}`, delivery: "smtp" };
  }

  if (!isStaffInviteEmailConfigured()) {
    return {
      ok: false,
      code: "config",
      error:
        "Branded uitnodigingsmail is niet geconfigureerd. Gebruik Supabase Auth invite of stel Graph Mail.Send / SMTP in.",
    };
  }

  const from =
    readServerEnv("STAFF_INVITE_FROM_EMAIL") ||
    defaultTransactionalFrom().replace(/^McCoy Website/, "McCoy Admin");
  const replyTo =
    readServerEnv("SMTP_REPLY_TO") ||
    readServerEnv("FORM_TO_EMAIL") ||
    undefined;

  const { subject, html, text } = buildStaffInviteEmail(input);
  const forceTo = (readServerEnv("FORM_REPLY_FORCE_TO") || "").trim().toLowerCase();
  const intendedTo = input.to.trim();
  const deliverTo = forceTo || intendedTo;
  const redirected = forceTo.length > 0 && forceTo !== intendedTo.toLowerCase();

  const subjectForSend = redirected ? `[TEST → ${intendedTo}] ${subject}` : subject;
  const htmlForSend = redirected
    ? `<p style="padding:12px;background:#fff7ed;color:#9a3412;font-size:13px;">Testomleiding. Bedoelde ontvanger: <strong>${escapeHtml(intendedTo)}</strong></p>${html}`
    : html;
  const textForSend = redirected
    ? `[TEST] Bedoelde ontvanger: ${intendedTo}\n\n${text}`
    : text;

  if (shouldAttemptGraphMail()) {
    const sent = await sendGraphAdminReply({
      to: deliverTo,
      subject: subjectForSend,
      html: htmlForSend,
      text: textForSend,
      replyTo,
    });
    if (sent.ok) {
      return { ok: true, messageId: sent.messageId, delivery: "graph" };
    }
    console.error("[staff-invite] Graph send failed; trying SMTP if usable", sent.error);
    if (!isSmtpUsableForOutbound()) {
      return {
        ok: false,
        code: "provider",
        error: sent.error,
      };
    }
  }

  if (!isSmtpUsableForOutbound()) {
    return {
      ok: false,
      code: "config",
      error:
        "SMTP is not usable for invites (missing config or Microsoft 365 SMTP AUTH disabled).",
    };
  }

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      code: "config",
      error: "SMTP is not configured (SMTP_* or FORM_INBOX_USER/PASS)",
    };
  }

  const sent = await sendSmtpMail({
    from,
    to: deliverTo,
    subject: subjectForSend,
    html: htmlForSend,
    text: textForSend,
    replyTo,
  });

  if (!sent.ok) {
    console.error("[staff-invite] SMTP error", sent.error);
    return {
      ok: false,
      code: "provider",
      error: sent.error,
    };
  }

  return { ok: true, messageId: sent.messageId, delivery: "smtp" };
}
