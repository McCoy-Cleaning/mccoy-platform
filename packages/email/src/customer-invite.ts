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
  formatEmailDateNl,
  renderTransactionalEmailHtml,
  renderTransactionalEmailText,
} from "./transactional-layout";

export type CustomerInviteEmailInput = {
  to: string;
  inviteUrl: string;
  companyName: string;
  inviteeFullName?: string | null;
  expiresAt?: string | null;
  isReminder?: boolean;
  isAccountAdmin?: boolean;
};

export function buildCustomerInviteEmail(input: CustomerInviteEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const greeting = staffEmailGreeting(input.inviteeFullName);
  const expiryLabel = formatEmailDateNl(input.expiresAt);
  const roleLabel = input.isAccountAdmin ? "accountbeheerder" : "gebruiker";
  const subject = input.isReminder
    ? "Herinnering: activeer uw McCoy klantenportaal"
    : `Uitnodiging voor het McCoy klantenportaal (${roleLabel})`;

  const logoUrl = staffEmailBrandLogoUrl();
  const intro = input.isReminder
    ? `Uw eerdere uitnodiging voor <strong>${escapeHtml(input.companyName)}</strong> is verlopen. Gebruik deze nieuwe link om uw account te activeren.`
    : `U bent uitgenodigd als ${escapeHtml(roleLabel)} voor <strong>${escapeHtml(input.companyName)}</strong> in het McCoy klantenportaal.`;

  const bodyHtml = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.5;">${greeting}</p>
    <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.5;">${intro}</p>
  `;

  const html = renderTransactionalEmailHtml({
    lang: "nl",
    logoUrl,
    title: "Klantenportaal",
    subtitle: "Activeer uw McCoy-account",
    bodyHtml,
    cta: { label: "Account activeren", url: input.inviteUrl },
    afterCtaHtml: expiryLabel
      ? `<p style="margin:0;color:#6b7280;font-size:13px;">Geldig tot ${escapeHtml(expiryLabel)}.</p>`
      : null,
    securityHtml:
      "Negeer dit bericht als u geen uitnodiging verwachtte. McCoy vraagt nooit om uw wachtwoord per e-mail.",
    footerText: "McCoy Cleaning · Vertrouwelijk",
  });

  const text = renderTransactionalEmailText({
    title: subject,
    greeting,
    paragraphs: [
      input.isReminder
        ? `Nieuwe activatielink voor ${input.companyName}.`
        : `Uitnodiging als ${roleLabel} voor ${input.companyName}.`,
    ],
    ctaLabel: "Account activeren",
    ctaUrl: input.inviteUrl,
    securityLines: ["Deel deze link met niemand."],
    footer: "— McCoy Cleaning",
  });

  return { subject, html, text };
}

export async function sendCustomerInviteEmail(
  input: CustomerInviteEmailInput,
): Promise<{ ok: boolean; transport?: string; error?: string }> {
  const { subject, html, text } = buildCustomerInviteEmail(input);
  const from = defaultTransactionalFrom();
  const prepared = prepareStaffEmailHtmlForDelivery(html);

  if (shouldAttemptGraphMail()) {
    const result = await sendGraphAdminReply({
      to: input.to,
      subject,
      html: prepared.html,
      text,
    });
    if (result.ok) return { ok: true, transport: "graph" };
  }

  if (isSmtpConfigured() && isSmtpUsableForOutbound()) {
    const smtp = await sendSmtpMail({
      to: input.to,
      subject,
      html: prepared.html,
      text,
      from,
    });
    if (!smtp.ok) {
      return { ok: false, transport: "smtp", error: smtp.error };
    }
    return { ok: true, transport: "smtp" };
  }

  if (readServerEnv("NODE_ENV") !== "production") {
    // Qualification must not silently "succeed" without delivering mail.
    if (readServerEnv("E2E_CUSTOMER_PORTAL_QUAL") === "1" || readServerEnv("FORM_INBOX_PROVIDER") === "imap") {
      return {
        ok: false,
        error:
          "SMTP not configured for qualification (expected SMTP_HOST/PORT/USER/PASSWORD → Mailpit).",
      };
    }
    console.info("[customer-invite] email skipped (no transport)", { to: input.to, subject });
    return { ok: true, transport: "dev-skip" };
  }

  return { ok: false, error: "E-mailtransport niet geconfigureerd." };
}
