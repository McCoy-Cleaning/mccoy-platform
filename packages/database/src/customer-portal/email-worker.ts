import { sendCustomerInviteEmail } from "@mccoy/email/server";
import { resetSmtpTransportCache } from "@mccoy/email/server";

import { customerActivationUrl } from "./config";
import {
  listUnprocessedCommerceEmails,
  markCommerceEmailFailed,
  markCommerceEmailProcessed,
} from "./email-outbox";
import { createSupabaseServiceClient } from "../supabase";

function applyQualificationSmtpIfNeeded(): void {
  if (process.env.E2E_CUSTOMER_PORTAL_QUAL !== "1") return;
  process.env.FORM_INBOX_PROVIDER = "imap";
  process.env.SMTP_HOST =
    process.env.QUALIFICATION_SMTP_HOST || process.env.SMTP_HOST || "127.0.0.1";
  process.env.SMTP_PORT =
    process.env.QUALIFICATION_SMTP_PORT || process.env.SMTP_PORT || "54325";
  process.env.SMTP_SECURE = "false";
  process.env.SMTP_USER = process.env.SMTP_USER || "qual@local.test";
  process.env.SMTP_PASSWORD = process.env.SMTP_PASSWORD || "qual-local-smtp";
  process.env.SMTP_PASS = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  process.env.SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "qual@local.test";
  resetSmtpTransportCache();
}

export async function processCommerceEmailOutbox(limit = 25): Promise<{
  processed: number;
  failed: number;
}> {
  applyQualificationSmtpIfNeeded();
  const rows = await listUnprocessedCommerceEmails(limit);
  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const rawToken = row.payload.rawToken as string | undefined;
      if (!rawToken) {
        await markCommerceEmailFailed(row.id, "missing rawToken in payload");
        failed += 1;
        continue;
      }

      const inviteUrl = customerActivationUrl(rawToken);
      const companyId = row.payload.companyId as string | undefined;
      let companyName = "uw bedrijf";
      if (companyId) {
        const supabase = createSupabaseServiceClient();
        const { data } = await supabase
          .from("companies")
          .select("legal_name, display_name")
          .eq("id", companyId)
          .maybeSingle();
        companyName =
          (data?.display_name as string | null) || (data?.legal_name as string) || companyName;
      }

      const intendedRole = row.payload.intendedRole as string | undefined;
      const result = await sendCustomerInviteEmail({
        to: row.toEmailNormalized,
        inviteUrl,
        companyName,
        inviteeFullName:
          (row.payload.inviteeFirstName as string | undefined) &&
          `${row.payload.inviteeFirstName} ${row.payload.inviteeLastName ?? ""}`.trim(),
        expiresAt: (row.payload.expiresAt as string | undefined) ?? null,
        isReminder: row.emailType === "CUSTOMER_INVITE_REMINDER",
        isAccountAdmin: intendedRole === "account_admin",
      });

      if (!result.ok) {
        await markCommerceEmailFailed(row.id, result.error ?? "send failed");
        failed += 1;
        continue;
      }

      await markCommerceEmailProcessed(row.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markCommerceEmailFailed(row.id, message);
      failed += 1;
    }
  }

  return { processed, failed };
}
