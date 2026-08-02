import { readServerEnv } from "@mccoy/security";

import {
  prepareStaffEmailHtmlForDelivery,
  staffEmailBrandLogoUrl,
  staffEmailGreeting,
  resolveStaffEmailRecipientName,
} from "./email-brand-logo";
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
  const invitee = resolveStaffEmailRecipientName(input.inviteeFullName);
  const inviter =
    input.invitedByName?.trim() ||
    input.invitedByEmail?.trim() ||
    "een McCoy superbeheerder";
  const expiryLabel = formatEmailDateNl(input.expiresAt);
  const greeting = staffEmailGreeting(input.inviteeFullName);
  const subject = "Uitnodiging voor McCoy Admin";
  const logoUrl = staffEmailBrandLogoUrl(input.logoUrl);

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

/** True when Graph is configured or non-M365 SMTP can send branded staff auth mail. */
export function isStaffInviteEmailConfigured(): boolean {
  return shouldAttemptGraphMail() || isSmtpUsableForOutbound();
}

/** Dutch error when Graph Mail.Send / SMTP is missing for staff invite or password reset. */
export function staffAuthEmailConfigErrorMessage(): string {
  return (
    "E-mailverzending is niet geconfigureerd voor admin-uitnodigingen en wachtwoordreset. " +
    "Stel dezelfde Microsoft Graph (Mail.Send) of SMTP-credentials in als voor Aanvragen/formulieren " +
    "(TENANT_ID, CLIENT_ID, CLIENT_SECRET, GRAPH_MAILBOX of SMTP_*)."
  );
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
 * Note: staff invite/reset delivery no longer falls back to Supabase Auth mail.
 */
export function shouldPreferBrandedStaffInviteFirst(): boolean {
  if (readServerEnv("STAFF_INVITE_BRANDED_FIRST").trim() === "1") {
    return isStaffInviteEmailConfigured();
  }
  return isSmtpUsableForOutbound();
}

export type StaffPasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  staffFullName?: string | null;
};

/**
 * Branded Dutch staff password-reset email (admin accounts only).
 */
export function buildStaffPasswordResetEmail(input: StaffPasswordResetEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = staffEmailGreeting(input.staffFullName);
  const subject = "Wachtwoord resetten — McCoy Admin";
  const logoUrl = staffEmailBrandLogoUrl(null);

  const bodyHtml = `
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 16px;color:#4b5563;">
      We hebben een verzoek ontvangen om je wachtwoord voor McCoy Admin te resetten.
      Klik op de knop hieronder om een nieuw wachtwoord in te stellen.
    </p>
    <p style="margin:0 0 16px;color:#4b5563;">
      Heb je dit niet aangevraagd? Negeer deze e-mail. Je wachtwoord blijft ongewijzigd.
    </p>`;

  const afterCtaHtml = `
    <p style="margin:0 0 8px;">Werkt de knop niet? Kopieer deze link naar je browser:</p>
    <p style="margin:0;color:#1e88e5;word-break:break-all;">${escapeHtml(input.resetUrl)}</p>`;

  const securityHtml = `
    <strong style="display:block;color:#111827;font-size:12px;margin-bottom:6px;">Beveiliging</strong>
    Deze link is persoonlijk en verloopt na gebruik. McCoy vraagt nooit om je wachtwoord
    of authenticatiecode per e-mail.`;

  const html = renderTransactionalEmailHtml({
    lang: "nl",
    logoUrl,
    logoAlt: "McCoy Cleaning",
    brandLabel: "McCoy Cleaning",
    title: "Wachtwoord resetten",
    subtitle: "Beveiligde toegang tot McCoy Admin",
    bodyHtml,
    cta: {
      label: "Nieuw wachtwoord instellen",
      url: input.resetUrl,
    },
    afterCtaHtml,
    securityHtml,
    footerText: "McCoy Cleaning · Vertrouwelijk · Alleen bedoeld voor de uitgenodigde ontvanger",
  });

  const text = renderTransactionalEmailText({
    title: "McCoy Cleaning — Wachtwoord resetten",
    greeting,
    paragraphs: [
      "We hebben een verzoek ontvangen om je wachtwoord voor McCoy Admin te resetten.",
      "Heb je dit niet aangevraagd? Negeer deze e-mail.",
    ],
    ctaLabel: "Nieuw wachtwoord instellen",
    ctaUrl: input.resetUrl,
    securityLines: [
      "Deze link is persoonlijk en verloopt na gebruik.",
      "McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.",
    ],
    footer: "— McCoy Cleaning · Vertrouwelijk",
  });

  return { subject, html, text };
}

export type StaffAccountRecoveryEmailInput = {
  to: string;
  recoveryUrl: string;
  staffFullName?: string | null;
  recoveredByName?: string | null;
  recoveredByEmail?: string | null;
  expiresAt?: string | null;
};

/**
 * Branded Dutch account-recovery email (super-admin initiated MFA reset).
 * Distinct from invite and password-reset copy.
 */
export function buildStaffAccountRecoveryEmail(input: StaffAccountRecoveryEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = staffEmailGreeting(input.staffFullName);
  const recoveredBy =
    input.recoveredByName?.trim() ||
    input.recoveredByEmail?.trim() ||
    "een McCoy superbeheerder";
  const expiryLabel = formatEmailDateNl(input.expiresAt);
  const subject = "Account herstellen — McCoy Admin";
  const logoUrl = staffEmailBrandLogoUrl(null);

  const steps = [
    "Scan een nieuwe QR-code in je authenticator-app",
    "Bevestig de 6-cijferige code",
    "Log daarna weer in met je bestaande wachtwoord en nieuwe 2FA-code",
  ];

  const stepsHtml = `
    <p style="margin:0 0 10px;color:#374151;font-size:14px;font-weight:600;">Via de link doorloop je:</p>
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
    <p style="margin:0 0 16px;color:#4b5563;">
      <strong style="color:#111827;">${escapeHtml(recoveredBy)}</strong> heeft je McCoy Admin-account
      hersteld omdat je geen toegang meer had tot je authenticator-app.
    </p>
    <p style="margin:0 0 16px;color:#4b5563;">
      Je profiel, rol en geschiedenis blijven behouden. Je oude tweestapsverificatie is
      uitgeschakeld; je stelt een nieuwe QR-code in via onderstaande link.
    </p>
    ${stepsHtml}
    ${
      expiryLabel
        ? `<p style="margin:0 0 20px;color:#6b7280;font-size:13px;">Deze herstellink is geldig tot <strong style="color:#111827;">${escapeHtml(expiryLabel)}</strong>.</p>`
        : ""
    }`;

  const afterCtaHtml = `
    <p style="margin:0 0 8px;">Werkt de knop niet? Kopieer deze link naar je browser:</p>
    <p style="margin:0;color:#1e88e5;word-break:break-all;">${escapeHtml(input.recoveryUrl)}</p>`;

  const securityHtml = `
    <strong style="display:block;color:#111827;font-size:12px;margin-bottom:6px;">Beveiliging</strong>
    Negeer dit bericht als je geen herstel verwachtte. Deel de link met niemand.
    McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.`;

  const html = renderTransactionalEmailHtml({
    lang: "nl",
    logoUrl,
    logoAlt: "McCoy Cleaning",
    brandLabel: "McCoy Cleaning",
    title: "Account herstellen",
    subtitle: "Nieuwe tweestapsverificatie instellen",
    bodyHtml,
    cta: {
      label: "Account herstellen",
      url: input.recoveryUrl,
    },
    afterCtaHtml,
    securityHtml,
    footerText: "McCoy Cleaning · Vertrouwelijk · Alleen bedoeld voor de uitgenodigde ontvanger",
  });

  const text = renderTransactionalEmailText({
    title: "McCoy Cleaning — Account herstellen",
    greeting,
    paragraphs: [
      `${recoveredBy} heeft je McCoy Admin-account hersteld omdat je geen toegang meer had tot je authenticator-app.`,
      "Je profiel, rol en geschiedenis blijven behouden. Je oude tweestapsverificatie is uitgeschakeld.",
      "Via de link doorloop je:",
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      expiryLabel ? `Deze herstellink is geldig tot ${expiryLabel}.` : "",
    ],
    ctaLabel: "Account herstellen",
    ctaUrl: input.recoveryUrl,
    securityLines: [
      "Negeer deze e-mail als je geen herstel verwachtte.",
      "Deel deze link met niemand.",
      "McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.",
    ],
    footer: "— McCoy Cleaning · Vertrouwelijk",
  });

  return { subject, html, text };
}

type StaffTransactionalMailKind = "invite" | "password-reset" | "account-recovery";

type StaffTransactionalSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  logTag: string;
  mailKind: StaffTransactionalMailKind;
};

/** Shared Graph → SMTP delivery for staff invite and password-reset mail. */
async function sendStaffTransactionalEmail(
  input: StaffTransactionalSendInput,
): Promise<SendStaffInviteEmailResult> {
  if (process.env.MCCOY_E2E === "1") {
    return { ok: true, messageId: `e2e-staff-mail-${Date.now()}`, delivery: "smtp" };
  }

  if (!isStaffInviteEmailConfigured()) {
    return {
      ok: false,
      code: "config",
      error: staffAuthEmailConfigErrorMessage(),
    };
  }

  const from =
    readServerEnv("STAFF_INVITE_FROM_EMAIL") ||
    defaultTransactionalFrom().replace(/^McCoy Website/, "McCoy Admin");
  const replyTo =
    readServerEnv("SMTP_REPLY_TO") ||
    readServerEnv("FORM_TO_EMAIL") ||
    undefined;

  // Staff auth mail must always reach the invitee — never FORM_REPLY_FORCE_TO (form reply testing only).
  const deliverTo = input.to.trim();
  const subjectForSend = input.subject;
  const htmlBody = input.html;
  const textForSend = input.text;

  const logoUrl = staffEmailBrandLogoUrl(null);
  const prepared = prepareStaffEmailHtmlForDelivery(htmlBody, logoUrl);
  const htmlForSend = prepared.html;
  const inlineLogoAttachments = prepared.inlineLogo
    ? [
        {
          filename: prepared.inlineLogo.filename,
          contentBase64: prepared.inlineLogo.contentBase64,
          contentType: prepared.inlineLogo.contentType,
          contentId: prepared.inlineLogo.contentId,
          isInline: true as const,
        },
      ]
    : [];

  const graphMailbox = readServerEnv("GRAPH_MAILBOX");

  if (shouldAttemptGraphMail()) {
    const sent = await sendGraphAdminReply({
      to: deliverTo,
      subject: subjectForSend,
      html: htmlForSend,
      text: textForSend,
      replyTo,
      // Staff transactional mail must appear in GRAPH_MAILBOX Sent Items for ops visibility.
      // Form notifications keep saveToSentItems: false to avoid Aanvragen inbox dupes.
      saveToSentItems: true,
      headers: {
        "x-mccoy-staff-mail": input.mailKind,
      },
      attachments: inlineLogoAttachments,
    });
    if (sent.ok) {
      console.info(`[${input.logTag}] Graph send accepted`, {
        mailKind: input.mailKind,
        mailbox: graphMailbox || "(graph)",
        saveToSentItems: true,
        to: deliverTo,
        messageId: sent.messageId ?? null,
      });
      return { ok: true, messageId: sent.messageId, delivery: "graph" };
    }
    console.error(`[${input.logTag}] Graph send failed; trying SMTP if configured`, {
      mailKind: input.mailKind,
      error: sent.error.slice(0, 240),
    });
    if (!isSmtpConfigured()) {
      return {
        ok: false,
        code: "provider",
        error: sent.error,
      };
    }
    if (!isSmtpUsableForOutbound()) {
      return {
        ok: false,
        code: "provider",
        error: `${sent.error} SMTP-fallback is uitgeschakeld voor Microsoft 365 (SMTP AUTH). Gebruik Graph Mail.Send op ${graphMailbox || "GRAPH_MAILBOX"}.`,
      };
    }
  }

  if (!isSmtpUsableForOutbound()) {
    return {
      ok: false,
      code: "config",
      error:
        "SMTP is niet bruikbaar voor admin-mail (Microsoft 365 SMTP AUTH uitgeschakeld). " +
        "Configureer Microsoft Graph Mail.Send (TENANT_ID, CLIENT_ID, CLIENT_SECRET, GRAPH_MAILBOX).",
    };
  }

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      code: "config",
      error:
        "SMTP is niet geconfigureerd (SMTP_* of FORM_INBOX_USER/PASS). " +
        "Voor M365: gebruik FORM_INBOX_PROVIDER=graph met Mail.Send.",
    };
  }

  const sent = await sendSmtpMail({
    from,
    to: deliverTo,
    subject: subjectForSend,
    html: htmlForSend,
    text: textForSend,
    replyTo,
    attachments: inlineLogoAttachments.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.contentBase64, "base64"),
      contentType: attachment.contentType,
      cid: attachment.contentId,
    })),
  });

  if (!sent.ok) {
    console.error(`[${input.logTag}] SMTP error`, {
      mailKind: input.mailKind,
      error: sent.error.slice(0, 240),
    });
    return {
      ok: false,
      code: "provider",
      error: sent.error,
    };
  }

  console.info(`[${input.logTag}] SMTP send accepted`, {
    mailKind: input.mailKind,
    to: deliverTo,
    messageId: sent.messageId ?? null,
  });
  return { ok: true, messageId: sent.messageId, delivery: "smtp" };
}

/**
 * Send branded invite via Microsoft Graph (preferred on M365) or usable SMTP.
 * Uses {@link buildStaffInviteEmail} — one template for both transports.
 */
export async function sendStaffInviteEmail(
  input: StaffInviteEmailInput,
): Promise<SendStaffInviteEmailResult> {
  const { subject, html, text } = buildStaffInviteEmail(input);
  return sendStaffTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    logTag: "staff-invite",
    mailKind: "invite",
  });
}

/**
 * Send branded password-reset mail via Microsoft Graph or SMTP (never Supabase Auth SMTP).
 */
export async function sendStaffPasswordResetEmail(
  input: StaffPasswordResetEmailInput,
): Promise<SendStaffInviteEmailResult> {
  const { subject, html, text } = buildStaffPasswordResetEmail(input);
  return sendStaffTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    logTag: "staff-password-reset",
    mailKind: "password-reset",
  });
}

/**
 * Send branded account-recovery mail (super-admin MFA reset) via Graph or SMTP.
 */
export async function sendStaffAccountRecoveryEmail(
  input: StaffAccountRecoveryEmailInput,
): Promise<SendStaffInviteEmailResult> {
  const { subject, html, text } = buildStaffAccountRecoveryEmail(input);
  return sendStaffTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
    logTag: "staff-account-recovery",
    mailKind: "account-recovery",
  });
}
