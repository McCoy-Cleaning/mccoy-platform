import { readServerEnv } from "@mccoy/security";

import { shouldAttemptGraphMail } from "./form-inbox-provider";
import { isGraphMailConfigured } from "./graph-config";
import { sendGraphAdminReply, type GraphSendReplyResult } from "./graph-mail";
import { decodeInboxMessageId } from "./inbox-message-id";
import { defaultTransactionalFrom, isSmtpConfigured, sendSmtpMail } from "./smtp";
import { escapeHtml } from "./templates";

function buildReplyHtml(options: {
  subject: string;
  body: string;
  requestNumber: string;
  redirected: boolean;
  intendedTo: string;
}): { html: string; text: string } {
  const safeBody = escapeHtml(options.body).replaceAll("\n", "<br />");
  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#0b1220;padding:24px 28px;">
                <div style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">McCoy Cleaning</div>
                <div style="color:#ffffff;font-size:20px;font-weight:700;margin-top:8px;">${escapeHtml(options.subject)}</div>
                <div style="color:#cbd5e1;font-size:13px;margin-top:6px;">Referentie: ${escapeHtml(options.requestNumber)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;color:#374151;font-size:14px;line-height:1.6;">
                ${
                  options.redirected
                    ? `<p style="margin:0 0 16px;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;font-size:13px;">Testomleiding: bedoelde ontvanger: <strong>${escapeHtml(options.intendedTo)}</strong></p>`
                    : ""
                }
                ${safeBody}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;color:#9ca3af;font-size:12px;">
                Dit bericht is verstuurd vanuit het McCoy admin panel. Antwoord op deze e-mail bereikt het McCoy team.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { html, text: options.body };
}

export type SendAdminReplyEmailResult =
  | {
      ok: true;
      messageId?: string;
      resendId?: string;
      graphMessageId?: string;
      internetMessageId?: string;
      conversationId?: string;
      sentAt?: string;
      identityPending?: boolean;
      usedGraphReply: boolean;
    }
  | { ok: false; error: string };

export async function sendAdminReplyEmail(options: {
  to: string;
  subject: string;
  body: string;
  requestNumber: string;
  /** Optional In-Reply-To / References for threading in the submitter's client. */
  inReplyTo?: string;
  /** Graph/IMAP inbox message id (`graph:…` or `imap:…`) for Graph reply threading. */
  inboxMessageId?: string;
}): Promise<SendAdminReplyEmailResult> {
  // Playwright / local E2E: do not call Graph or SMTP; treat reply as accepted.
  if (process.env.MCCOY_E2E === "1") {
    return {
      ok: true,
      messageId: `e2e-reply-${Date.now()}`,
      resendId: `e2e-reply-${Date.now()}`,
      usedGraphReply: false,
    };
  }

  const from = defaultTransactionalFrom();
  const replyTo =
    readServerEnv("SMTP_REPLY_TO") ||
    readServerEnv("FORM_TO_EMAIL") ||
    "oana.dine1571@gmail.com";
  const bccInbox =
    readServerEnv("FORM_TO_EMAIL") ||
    readServerEnv("FORM_INBOX_USER") ||
    readServerEnv("SMTP_USER") ||
    "";
  /** Dev/test only: deliver to this address instead of the submitter. */
  const forceTo = (readServerEnv("FORM_REPLY_FORCE_TO") || "").trim().toLowerCase();

  const intendedTo = options.to.trim();
  const deliverTo = forceTo || intendedTo;
  const redirected = forceTo.length > 0 && forceTo !== intendedTo.toLowerCase();

  const bodyForSend = redirected
    ? `[TEST] Dit antwoord was bedoeld voor: ${intendedTo}\n\n${options.body}`
    : options.body;
  const subjectForSend = redirected
    ? `[TEST → ${intendedTo}] ${options.subject}`
    : options.subject;

  const { html, text } = buildReplyHtml({
    subject: subjectForSend,
    body: bodyForSend,
    requestNumber: options.requestNumber,
    redirected,
    intendedTo,
  });

  let inReplyToGraphId: string | undefined;
  if (options.inboxMessageId) {
    try {
      const decoded = decodeInboxMessageId(options.inboxMessageId);
      if (decoded.provider === "graph") {
        inReplyToGraphId = decoded.graphId;
      }
    } catch {
      inReplyToGraphId = undefined;
    }
  }

  // When we have a Graph parent message, use createReply so conversationId /
  // In-Reply-To stay intact. Override toRecipients to the website visitor
  // (form notifications are From our mailbox — bare /reply would loop to us).
  // Form *notifications* (new submissions) still use sendMail without a parent id.

  if (shouldAttemptGraphMail()) {
    const sent: GraphSendReplyResult = await sendGraphAdminReply({
      to: deliverTo,
      subject: subjectForSend,
      html,
      text,
      replyTo,
      // BCC only when not using Graph reply (reply stays in the conversation).
      ...(!inReplyToGraphId &&
      bccInbox &&
      bccInbox.toLowerCase() !== deliverTo.toLowerCase()
        ? { bcc: bccInbox }
        : {}),
      inReplyToGraphId,
      inReplyToInternetMessageId: options.inReplyTo,
      headers: {
        ...(options.requestNumber
          ? { "x-mccoy-request-number": options.requestNumber }
          : {}),
        ...(options.inReplyTo
          ? { "x-mccoy-in-reply-to": options.inReplyTo.replace(/[<>\s]/g, "").slice(0, 200) }
          : {}),
      },
    });
    if (!sent.ok) {
      // Microsoft 365: SMTP AUTH is typically blocked (535). Do not mask the
      // Graph error with a useless SMTP fallback when Graph is configured.
      if (isGraphMailConfigured()) {
        return sent;
      }
      if (!isSmtpConfigured()) {
        return sent;
      }
      console.error("[email] Graph send failed; falling back to SMTP", sent.error);
    } else {
      return {
        ok: true,
        messageId: sent.internetMessageId ?? sent.messageId,
        resendId: sent.internetMessageId ?? sent.messageId,
        graphMessageId: sent.graphMessageId,
        internetMessageId: sent.internetMessageId,
        conversationId: sent.conversationId,
        sentAt: sent.sentAt,
        identityPending: sent.identityPending,
        usedGraphReply: Boolean(inReplyToGraphId),
      };
    }
  }

  const headers: Record<string, string> = {};
  if (options.inReplyTo) {
    headers["In-Reply-To"] = options.inReplyTo;
    headers.References = options.inReplyTo;
  }

  const willBcc = !!bccInbox && bccInbox.toLowerCase() !== deliverTo.toLowerCase();

  const sent = await sendSmtpMail({
    from,
    to: deliverTo,
    replyTo,
    ...(willBcc ? { bcc: bccInbox } : {}),
    subject: subjectForSend,
    html,
    text,
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return {
    ok: true,
    messageId: sent.messageId,
    /** @deprecated legacy JSON field name — same as messageId */
    resendId: sent.messageId,
    internetMessageId: sent.messageId,
    usedGraphReply: false,
  };
}
