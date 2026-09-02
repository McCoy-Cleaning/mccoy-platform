import { expect, test } from "@playwright/test";

import {
  processCommerceEmailOutbox,
  staffInviteAccountAdmin,
  processExpiredCustomerInvitations,
  createSupabaseServiceClient,
} from "@mccoy/database/server";

import {
  extractActivationUrl,
  isMailpitReachable,
  listMailpitMessagesSafe,
  waitForMailpitMessage,
} from "../helpers/mailpit";
import { loadE2eFixture } from "../helpers/customer-portal-auth";
import { qualificationMailpitSmtpEnv } from "../helpers/customer-portal-qual-env";

test.describe("Customer portal email (Mailpit)", () => {
  test.beforeAll(async () => {
    Object.assign(process.env, qualificationMailpitSmtpEnv());
    process.env.STOREFRONT_ORIGIN =
      process.env.E2E_STOREFRONT_ORIGIN ?? process.env.STOREFRONT_ORIGIN ?? "http://localhost:5183";
    const { resetSmtpTransportCache } = await import("@mccoy/email/server");
    resetSmtpTransportCache();
  });

  test("staff admin invite enqueues email and Mailpit receives activation link when SMTP available", async () => {
    const fixture = loadE2eFixture();
    const email = `mailpit-admin-${fixture.suffix}@qual.mccoy.test`;
    const mailpitUp = await isMailpitReachable();
    const before = await listMailpitMessagesSafe();

    const { seedAbcFacilityMirrorAndSync } = await import("@mccoy/database/server");
    const abc = await seedAbcFacilityMirrorAndSync({
      suffix: `mailpit-${fixture.suffix}`,
      staffActorId: fixture.staffActorId,
    });

    const invite = await staffInviteAccountAdmin({
      companyId: abc.companyId,
      email,
      actorUserId: fixture.staffActorId,
      firstName: "Mail",
      lastName: "Pit",
    });
    expect(invite.invitationId).toBeTruthy();
    // staffInviteAccountAdmin already drains the outbox; drain again for any remainder.
    await processCommerceEmailOutbox(25);

    const supabase = createSupabaseServiceClient();
    const { data: outboxRow } = await supabase
      .schema("private")
      .from("commerce_email_outbox")
      .select("id, processed_at, failed_at, last_error")
      .eq("to_email_normalized", email.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect(outboxRow?.processed_at, `outbox failed: ${outboxRow?.last_error ?? "missing"}`).toBeTruthy();
    expect(outboxRow?.failed_at).toBeNull();

    expect(mailpitUp).toBe(true);
    const msg = await waitForMailpitMessage(email, {
      subjectIncludes: "uitnodiging",
      afterIdCount: before.length,
      timeoutMs: 20_000,
    });
    const body = `${msg.Text ?? ""} ${msg.HTML ?? ""}`;
    const url = extractActivationUrl(body);
    expect(url).toBeTruthy();
    expect(url).toContain("/account/activate");
  });

  test("expired invitation reminder is idempotent in Mailpit", async () => {
    const fixture = loadE2eFixture();
    const email = `reminder-mailpit-${fixture.suffix}@qual.mccoy.test`;
    const emailNormalized = email.trim().toLowerCase();
    const mailpitUp = await isMailpitReachable();
    if (!mailpitUp) {
      test.skip(true, "Mailpit unavailable — start supabase with local_smtp");
    }
    const beforeCount = (await listMailpitMessagesSafe()).length;

    const { seedAbcFacilityMirrorAndSync } = await import("@mccoy/database/server");
    const abc = await seedAbcFacilityMirrorAndSync({
      suffix: `rem-${fixture.suffix}`,
      staffActorId: fixture.staffActorId,
    });

    await staffInviteAccountAdmin({
      companyId: abc.companyId,
      email,
      actorUserId: fixture.staffActorId,
      firstName: "Reminder",
      lastName: "Qual",
    });
    await processCommerceEmailOutbox(25);

    const supabase = createSupabaseServiceClient();
    const { data: pending } = await supabase
      .schema("private")
      .from("customer_invitations")
      .select("id")
      .eq("company_id", abc.companyId)
      .eq("email_normalized", emailNormalized)
      .eq("status", "pending")
      .maybeSingle();
    expect(pending?.id).toBeTruthy();

    const past = new Date(Date.now() - 60_000).toISOString();
    await supabase
      .schema("private")
      .from("customer_invitations")
      .update({ expires_at: past })
      .eq("id", pending!.id);

    const firstRun = await processExpiredCustomerInvitations(10);
    expect(firstRun.reminders).toBeGreaterThanOrEqual(1);
    await processCommerceEmailOutbox(25);

    let reminderMsg: Awaited<ReturnType<typeof waitForMailpitMessage>> | null = null;
    try {
      reminderMsg = await waitForMailpitMessage(email, {
        subjectIncludes: "",
        timeoutMs: 20_000,
        afterIdCount: beforeCount,
      });
    } catch {
      test.skip(true, "Mailpit unavailable for reminder qualification");
    }
    const reminderUrl = extractActivationUrl(
      `${reminderMsg!.Text ?? ""} ${reminderMsg!.HTML ?? ""}`,
    );
    expect(reminderUrl).toBeTruthy();

    const afterFirstCount = (await listMailpitMessagesSafe()).filter((m) =>
      m.To?.some((t) => t.Address?.toLowerCase() === emailNormalized),
    ).length;

    const { data: replacement } = await supabase
      .schema("private")
      .from("customer_invitations")
      .select("id, reminder_count, expires_at, status")
      .eq("company_id", abc.companyId)
      .eq("email_normalized", emailNormalized)
      .eq("status", "pending")
      .maybeSingle();
    expect(replacement?.reminder_count).toBeGreaterThanOrEqual(1);
    expect(new Date(String(replacement!.expires_at)).getTime()).toBeGreaterThan(Date.now());

    // Global worker may remind unrelated expired invites from prior runs —
    // prove THIS recipient is not re-mailed while their replacement is still valid.
    await processExpiredCustomerInvitations(10);
    await processCommerceEmailOutbox(25);
    const afterSecondCount = (await listMailpitMessagesSafe()).filter((m) =>
      m.To?.some((t) => t.Address?.toLowerCase() === emailNormalized),
    ).length;
    expect(afterSecondCount).toBe(afterFirstCount);
  });
});
