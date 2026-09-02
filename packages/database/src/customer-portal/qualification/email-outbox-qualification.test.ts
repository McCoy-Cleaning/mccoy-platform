import { beforeAll, describe, expect, it } from "vitest";

import { createCustomerInvitation } from "../invitations";
import { processCommerceEmailOutbox } from "../email-worker";
import { applyQualificationEnv, isQualificationDbReachable } from "./env";
import { seedQualificationCompanies, type QualificationCompanies } from "./seed";
import { createSupabaseServiceClient } from "../../supabase";

const qualAvailable = await isQualificationDbReachable();

describe.skipIf(!qualAvailable)("Commerce email outbox qualification", () => {
  let fixtures: QualificationCompanies;

  beforeAll(async () => {
    applyQualificationEnv();
    fixtures = await seedQualificationCompanies(
      applyQualificationEnv(),
    );
  }, 120_000);

  it("enqueues outbox row on invitation and processes without persisting raw token in DB", async () => {
    const email = `outbox-${fixtures.suffix}@qual.mccoy.test`;
    const invite = await createCustomerInvitation({
      companyId: fixtures.companyAId,
      email,
      intendedRole: "account_user",
      invitedByType: "account_admin",
      invitedByUserId: fixtures.adminA.userId,
      emailType: "CUSTOMER_ACCOUNT_USER_INVITE",
      auditAction: "customer.portal_user_invited",
      actorUserId: fixtures.adminA.userId,
    });

    const supabase = createSupabaseServiceClient();
    const { data: outbox } = await supabase
      .schema("private")
      .from("commerce_email_outbox")
      .select("id, email_type, dedupe_key, payload, processed_at")
      .eq("invitation_id", invite.invitationId)
      .maybeSingle();

    expect(outbox).toBeTruthy();
    expect(outbox?.email_type).toBe("CUSTOMER_ACCOUNT_USER_INVITE");
    expect(outbox?.dedupe_key).toBe(`invite:${invite.invitationId}`);
    expect(outbox?.payload?.rawToken).toBe(invite.rawToken);

    const { data: invitationRow } = await supabase
      .schema("private")
      .from("customer_invitations")
      .select("token_hash")
      .eq("id", invite.invitationId)
      .maybeSingle();
    expect(invitationRow?.token_hash).not.toBe(invite.rawToken);

    const result = await processCommerceEmailOutbox(50);
    expect(result.processed + result.failed).toBeGreaterThanOrEqual(1);

    let processed: { processed_at: string | null; failed_at: string | null } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data } = await supabase
        .schema("private")
        .from("commerce_email_outbox")
        .select("processed_at, failed_at")
        .eq("id", outbox!.id as string)
        .maybeSingle();
      processed = data;
      if (processed?.processed_at ?? processed?.failed_at) break;
      await processCommerceEmailOutbox(50);
    }
    expect(processed?.processed_at ?? processed?.failed_at).toBeTruthy();
  });
});
