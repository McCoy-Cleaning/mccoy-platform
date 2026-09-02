import { customerInviteMaxReminders } from "./config";
import { enqueueCommerceEmailOutbox } from "./email-outbox";
import { createCustomerInvitation } from "./invitations";
import { generateInvitationToken } from "./tokens";
import { createSupabaseServiceClient } from "../supabase";

/**
 * Process expired pending invitations: mark expired, optionally send reminder with replacement invite.
 * Idempotent under concurrent workers via row-level status transitions.
 */
export async function processExpiredCustomerInvitations(limit = 25): Promise<{
  expired: number;
  reminders: number;
}> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const maxReminders = customerInviteMaxReminders();

  const { data: expiredRows, error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("*")
    .eq("status", "pending")
    .lt("expires_at", now)
    .limit(limit);
  if (error) throw new Error(`processExpiredCustomerInvitations: ${error.message}`);

  let expired = 0;
  let reminders = 0;

  for (const row of expiredRows ?? []) {
    const { data: marked } = await supabase
      .schema("private")
      .from("customer_invitations")
      .update({ status: "expired" })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!marked) continue;
    expired += 1;

    const reminderCount = Number(row.reminder_count ?? 0);
    if (reminderCount >= maxReminders) continue;

    const rawToken = generateInvitationToken();
    const { hashInvitationToken } = await import("./tokens");
    const tokenHash = hashInvitationToken(rawToken);
    const { customerInviteTtlHours } = await import("./config");
    const expiresAt = new Date(Date.now() + customerInviteTtlHours() * 60 * 60 * 1000).toISOString();

    const { data: replacement, error: replaceError } = await supabase
      .schema("private")
      .from("customer_invitations")
      .insert({
        company_id: row.company_id,
        email: row.email,
        email_normalized: row.email_normalized,
        intended_role: row.intended_role,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
        invited_by_type: row.invited_by_type,
        invited_by_user_id: row.invited_by_user_id,
        invitee_first_name: row.invitee_first_name,
        invitee_last_name: row.invitee_last_name,
        invitee_phone: row.invitee_phone,
        reminder_count: reminderCount + 1,
        last_reminder_at: now,
      })
      .select("id")
      .single();

    if (replaceError) {
      if (replaceError.code === "23505") continue;
      throw new Error(`processExpiredCustomerInvitations replacement: ${replaceError.message}`);
    }

    await enqueueCommerceEmailOutbox({
      emailType: "CUSTOMER_INVITE_REMINDER",
      toEmailNormalized: String(row.email_normalized),
      invitationId: String(replacement.id),
      dedupeKey: `reminder:${row.id}:${reminderCount + 1}`,
      payload: {
        invitationId: replacement.id,
        companyId: row.company_id,
        intendedRole: row.intended_role,
        rawToken,
        expiresAt,
      },
    });

    reminders += 1;
  }

  return { expired, reminders };
}
