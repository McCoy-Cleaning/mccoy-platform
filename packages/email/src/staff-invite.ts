import { readServerEnv } from "@mccoy/security";

import { defaultTransactionalFrom, isSmtpConfigured, sendSmtpMail } from "./smtp";
import { escapeHtml } from "./templates";

export type StaffInviteEmailInput = {
  to: string;
  inviteUrl: string;
  invitedByName?: string | null;
  invitedByEmail?: string | null;
  inviteeFullName?: string | null;
  expiresAt?: string | null;
};

function formatExpiryNl(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

/**
 * Branded Dutch staff-invite email (admin role only).
 * CTA uses the Auth Admin action_link — never put secrets in the body.
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
  const expiryLabel = formatExpiryNl(input.expiresAt);
  const greeting = invitee ? `Beste ${invitee},` : "Beste collega,";

  const subject = "Uitnodiging voor McCoy Admin";

  const text = [
    greeting,
    "",
    `${inviter} nodigt je uit voor toegang tot het McCoy Admin-panel als beheerder.`,
    "",
    "Na acceptatie stel je een wachtwoord in en activeer je verplichte tweestapsverificatie (TOTP) voordat je volledige toegang krijgt.",
    expiryLabel ? `Deze uitnodiging verloopt op ${expiryLabel}.` : "",
    "",
    `Uitnodiging accepteren: ${input.inviteUrl}`,
    "",
    "Beveiliging:",
    "- Negeer deze e-mail als je geen uitnodiging verwachtte.",
    "- Deel deze link met niemand.",
    "- McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.",
    "",
    "— McCoy Cleaning",
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="nl">
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#12121a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);">
            <tr>
              <td style="background:linear-gradient(135deg,#0b1220 0%,#151528 100%);padding:28px 32px;">
                <div style="color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">McCoy Cleaning</div>
                <div style="color:#ffffff;font-size:24px;font-weight:700;margin-top:10px;letter-spacing:-0.02em;">Admin-uitnodiging</div>
                <div style="color:#94a3b8;font-size:13px;margin-top:8px;line-height:1.5;">Beveiligde toegang tot het McCoy control center</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 8px;color:#e2e8f0;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
                <p style="margin:0 0 16px;">
                  <strong style="color:#ffffff;">${escapeHtml(inviter)}</strong> nodigt je uit als
                  <strong style="color:#ffffff;">beheerder</strong> in McCoy Admin.
                </p>
                <p style="margin:0 0 16px;color:#cbd5e1;">
                  Na acceptatie stel je je wachtwoord in${invitee ? "" : " en je naam"} en activeer je
                  <strong style="color:#ffffff;">verplichte tweestapsverificatie (TOTP)</strong>
                  voordat je volledige toegang krijgt.
                </p>
                ${
                  expiryLabel
                    ? `<p style="margin:0 0 20px;color:#94a3b8;font-size:13px;">Geldig tot <strong style="color:#e2e8f0;">${escapeHtml(expiryLabel)}</strong>.</p>`
                    : ""
                }
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
                  <tr>
                    <td style="border-radius:12px;background:#1e88e5;">
                      <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">
                        Uitnodiging accepteren
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5;">
                  Werkt de knop niet? Kopieer deze link naar je browser:<br />
                  <span style="color:#93c5fd;word-break:break-all;">${escapeHtml(input.inviteUrl)}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;color:#94a3b8;font-size:12px;line-height:1.55;">
                  <strong style="color:#cbd5e1;">Beveiliging</strong><br />
                  Negeer dit bericht als je geen uitnodiging verwachtte. Deel de link met niemand.
                  McCoy vraagt nooit om je wachtwoord of authenticatiecode per e-mail.
                </div>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;color:#475569;font-size:11px;">McCoy Cleaning · Vertrouwelijk</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

export type SendStaffInviteEmailResult =
  | { ok: true; messageId?: string; delivery: "smtp" }
  | { ok: false; error: string; code: "config" | "provider" };

/**
 * Send branded invite via SMTP (Nodemailer) when configured.
 * Caller should fall back to Supabase Auth invite email when this returns config failure.
 */
export async function sendStaffInviteEmail(
  input: StaffInviteEmailInput,
): Promise<SendStaffInviteEmailResult> {
  const from =
    readServerEnv("STAFF_INVITE_FROM_EMAIL") ||
    defaultTransactionalFrom().replace(/^McCoy Website/, "McCoy Admin");

  if (!isSmtpConfigured()) {
    return {
      ok: false,
      code: "config",
      error: "SMTP is not configured (SMTP_* or FORM_INBOX_USER/PASS)",
    };
  }

  const { subject, html, text } = buildStaffInviteEmail(input);
  const forceTo = (readServerEnv("FORM_REPLY_FORCE_TO") || "").trim().toLowerCase();
  const intendedTo = input.to.trim();
  const deliverTo = forceTo || intendedTo;
  const redirected = forceTo.length > 0 && forceTo !== intendedTo.toLowerCase();

  const sent = await sendSmtpMail({
    from,
    to: deliverTo,
    subject: redirected ? `[TEST → ${intendedTo}] ${subject}` : subject,
    html: redirected
      ? `<p style="padding:12px;background:#fff7ed;color:#9a3412;font-size:13px;">Testomleiding. Bedoelde ontvanger: <strong>${escapeHtml(intendedTo)}</strong></p>${html}`
      : html,
    text,
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

export function isStaffInviteEmailConfigured(): boolean {
  return isSmtpConfigured();
}
