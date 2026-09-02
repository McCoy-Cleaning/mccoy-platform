import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { CustomerPortalError } from "../errors";
import { activateCustomerAccount } from "../activation";
import { customerCompletePasswordReset, resolveCustomerMembership } from "../customer-auth";
import { createCustomerInvitation, peekInvitationByRawToken } from "../invitations";
import { listPortalCompanies } from "../list-portal-companies";
import { transferAccountAdmin } from "../membership";
import { processExpiredCustomerInvitations } from "../reminders";
import { hashInvitationToken } from "../tokens";
import { accountAdminInviteUser, staffInviteAccountAdmin } from "../staff-onboarding";
import {
  LegacyMirrorExistingCustomerProvider,
  syncExistingServiceClients,
} from "../existing-customer-sync";
import { createSupabaseServiceClient } from "../../supabase";
import { createCompany } from "../../commerce/core";
import { findAuthUserIdByEmail } from "../../staff";
import { applyQualificationEnv, isQualificationDbReachable, type QualificationSupabaseConfig } from "./env";
import { seedQualificationCompanies, type QualificationCompanies } from "./seed";

const qualAvailable = await isQualificationDbReachable();

describe.skipIf(!qualAvailable)("Commerce Phase 2 qualification (isolated DB)", () => {
  let config: QualificationSupabaseConfig;
  let fixtures: QualificationCompanies;

  beforeAll(async () => {
    config = applyQualificationEnv();
    fixtures = await seedQualificationCompanies(config);
  }, 120_000);

  function customerClient(accessToken: string) {
    return createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }

  describe("private schema exposure", () => {
    it("denies anon and authenticated direct access to private tables", async () => {
      const anon = createClient(config.url, config.publishableKey, {
        auth: { persistSession: false },
      });
      const { error: anonErr } = await anon.schema("private").from("customer_invitations").select("id");
      expect(anonErr?.message ?? "").toMatch(/permission denied|schema private/i);

      const customer = customerClient(fixtures.userA.accessToken);
      const { error: authErr } = await customer.schema("private").from("customer_invitations").select("id");
      expect(authErr?.message ?? "").toMatch(/permission denied|schema private/i);

      const { error: outboxErr } = await customer.schema("private").from("commerce_email_outbox").select("id");
      expect(outboxErr?.message ?? "").toMatch(/permission denied|schema private/i);
    });
  });

  describe("RLS company isolation", () => {
    it("denies Company B reads for Company A users", async () => {
      const client = customerClient(fixtures.userA.accessToken);
      const { data: companies } = await client.from("companies").select("id").eq("id", fixtures.companyBId);
      expect(companies ?? []).toHaveLength(0);

      const { data: members } = await client
        .from("company_users")
        .select("user_id")
        .eq("company_id", fixtures.companyBId);
      expect(members ?? []).toHaveLength(0);

      const { data: orders } = await client.from("orders").select("id").eq("company_id", fixtures.companyBId);
      expect(orders ?? []).toHaveLength(0);
    });

    it("allows same-company membership visibility for account admin", async () => {
      const client = customerClient(fixtures.adminA.accessToken);
      const { data, error } = await client
        .from("company_users")
        .select("user_id")
        .eq("company_id", fixtures.companyAId);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("privilege matrix", () => {
    it("denies account user invite/suspend at domain layer", async () => {
      await expect(
        accountAdminInviteUser({
          companyId: fixtures.companyAId,
          email: `blocked-invite-${fixtures.suffix}@qual.mccoy.test`,
          actorUserId: fixtures.userA.userId,
        }),
      ).rejects.toBeInstanceOf(CustomerPortalError);

      const { suspendCompanyMembership } = await import("../membership");
      await expect(
        suspendCompanyMembership({
          companyId: fixtures.companyAId,
          userId: fixtures.adminA.userId,
          actorUserId: fixtures.userA.userId,
        }),
      ).rejects.toBeInstanceOf(CustomerPortalError);
    });

    it("allows account admin to invite account user", async () => {
      const email = `invited-user-${fixtures.suffix}@qual.mccoy.test`;
      const result = await accountAdminInviteUser({
        companyId: fixtures.companyAId,
        email,
        actorUserId: fixtures.adminA.userId,
        firstName: "Invited",
        lastName: "User",
      });
      expect(result.invitationId).toBeTruthy();
    });

    it("denies account admin inviting another account admin", async () => {
      await expect(
        createCustomerInvitation({
          companyId: fixtures.companyAId,
          email: `admin2-${fixtures.suffix}@qual.mccoy.test`,
          intendedRole: "account_admin",
          invitedByType: "account_admin",
          invitedByUserId: fixtures.adminA.userId,
          emailType: "CUSTOMER_ACCOUNT_ADMIN_INVITE",
          auditAction: "customer.portal_invite_sent",
          actorUserId: fixtures.adminA.userId,
        }),
      ).rejects.toBeInstanceOf(CustomerPortalError);
    });
  });

  describe("suspension", () => {
    it("denies portal access immediately after membership suspension", async () => {
      const supabase = createSupabaseServiceClient();
      expect(await resolveCustomerMembership(fixtures.userB.userId)).not.toBeNull();

      await supabase
        .from("company_users")
        .update({ status: "suspended" })
        .eq("company_id", fixtures.companyBId)
        .eq("user_id", fixtures.userB.userId);

      expect(await resolveCustomerMembership(fixtures.userB.userId)).toBeNull();

      const { data: authUser } = await supabase.auth.getUser(fixtures.userB.accessToken);
      expect(authUser.user?.id).toBe(fixtures.userB.userId);

      await supabase
        .from("company_users")
        .update({ status: "active" })
        .eq("company_id", fixtures.companyBId)
        .eq("user_id", fixtures.userB.userId);
    });

    it("denies portal when company is blocked but membership active", async () => {
      const supabase = createSupabaseServiceClient();
      await supabase
        .from("companies")
        .update({ status: "blocked", blocked_at: new Date().toISOString() })
        .eq("id", fixtures.companyBId);

      expect(await resolveCustomerMembership(fixtures.adminB.userId)).toBeNull();

      await supabase
        .from("companies")
        .update({ status: "active", blocked_at: null })
        .eq("id", fixtures.companyBId);
    });
  });

  describe("invitation attacks and token hygiene", () => {
    it("rejects invalid, revoked, and consumed tokens", async () => {
      const invite = await createCustomerInvitation({
        companyId: fixtures.companyAId,
        email: `token-test-${fixtures.suffix}@qual.mccoy.test`,
        intendedRole: "account_user",
        invitedByType: "account_admin",
        invitedByUserId: fixtures.adminA.userId,
        emailType: "CUSTOMER_ACCOUNT_USER_INVITE",
        auditAction: "customer.portal_user_invited",
        actorUserId: fixtures.adminA.userId,
      });

      expect(await peekInvitationByRawToken("not-a-real-token")).toEqual({
        ok: false,
        code: "CUSTOMER_INVITE_INVALID",
      });

      const supabase = createSupabaseServiceClient();
      const { data: row } = await supabase
        .schema("private")
        .from("customer_invitations")
        .select("token_hash")
        .eq("id", invite.invitationId)
        .maybeSingle();
      expect(row?.token_hash).toBe(hashInvitationToken(invite.rawToken));
      expect(row?.token_hash).not.toBe(invite.rawToken);

      await activateCustomerAccount({
        rawToken: invite.rawToken,
        password: "Activate-Password-123!",
        firstName: "Token",
        lastName: "Test",
      });

      expect(await peekInvitationByRawToken(invite.rawToken)).toEqual({
        ok: false,
        code: "CUSTOMER_INVITE_USED",
      });

      const resend = await createCustomerInvitation({
        companyId: fixtures.companyAId,
        email: `token-test-${fixtures.suffix}@qual.mccoy.test`,
        intendedRole: "account_user",
        invitedByType: "account_admin",
        invitedByUserId: fixtures.adminA.userId,
        emailType: "CUSTOMER_ACCOUNT_USER_INVITE",
        auditAction: "customer.portal_user_invited",
        actorUserId: fixtures.adminA.userId,
      });
      await supabase
        .schema("private")
        .from("customer_invitations")
        .update({ status: "revoked", revoked_at: new Date().toISOString() })
        .eq("id", resend.invitationId);
      expect(await peekInvitationByRawToken(resend.rawToken)).toEqual({
        ok: false,
        code: "CUSTOMER_INVITE_REVOKED",
      });
    });
  });

  describe("concurrency and invariants", () => {
    it("allows exactly one parallel activation", async () => {
      const email = `race-activate-${fixtures.suffix}@qual.mccoy.test`;
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

      const input = {
        rawToken: invite.rawToken,
        password: "Race-Password-123!",
        firstName: "Race",
        lastName: "User",
      };
      const results = await Promise.allSettled([
        activateCustomerAccount(input),
        activateCustomerAccount(input),
      ]);
      const successes = results.filter((r) => r.status === "fulfilled");
      const failures = results.filter((r) => r.status === "rejected");
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      const supabase = createSupabaseServiceClient();
      const { count: userCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("email", email);
      expect(userCount).toBe(1);
    });

    it("keeps one pending account admin invitation under parallel staff invites", async () => {
      const company = await createCompany({
        legalName: `Race Admin Co ${fixtures.suffix}`,
        companyType: "service_client",
        status: "active",
        externalCustomerId: `race-admin-${fixtures.suffix}`,
      });

      const results = await Promise.allSettled([
        staffInviteAccountAdmin({
          companyId: company.id,
          email: `peter-${fixtures.suffix}@qual.mccoy.test`,
          actorUserId: fixtures.staffActorId,
          firstName: "Peter",
        }),
        staffInviteAccountAdmin({
          companyId: company.id,
          email: `sophie-${fixtures.suffix}@qual.mccoy.test`,
          actorUserId: fixtures.staffActorId,
          firstName: "Sophie",
        }),
      ]);

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.filter((r) => r.status === "rejected").length;
      expect(ok + fail).toBe(2);

      const supabase = createSupabaseServiceClient();
      const { count } = await supabase
        .schema("private")
        .from("customer_invitations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("intended_role", "account_admin")
        .eq("status", "pending");
      expect(count).toBe(1);
    });

    it("maintains single account admin after parallel transfer attempts", async () => {
      const company = await createCompany({
        legalName: `Transfer Co ${fixtures.suffix}`,
        companyType: "service_client",
        status: "active",
        externalCustomerId: `transfer-${fixtures.suffix}`,
      });
      const supabase = createSupabaseServiceClient();

      const peterEmail = `peter-t-${fixtures.suffix}@qual.mccoy.test`;
      const sophieEmail = `sophie-t-${fixtures.suffix}@qual.mccoy.test`;
      const markEmail = `mark-t-${fixtures.suffix}@qual.mccoy.test`;

      const peterInv = await createCustomerInvitation({
        companyId: company.id,
        email: peterEmail,
        intendedRole: "account_admin",
        invitedByType: "staff",
        invitedByUserId: fixtures.staffActorId,
        emailType: "CUSTOMER_ACCOUNT_ADMIN_INVITE",
        auditAction: "customer.portal_invite_sent",
        actorUserId: fixtures.staffActorId,
      });
      await activateCustomerAccount({
        rawToken: peterInv.rawToken,
        password: "Transfer-Password-123!",
        firstName: "Peter",
        lastName: "User",
      });

      const peterId = await findAuthUserIdByEmail(peterEmail);

      for (const [email, role] of [
        [sophieEmail, "account_user"],
        [markEmail, "account_user"],
      ] as const) {
        const inv = await createCustomerInvitation({
          companyId: company.id,
          email,
          intendedRole: role,
          invitedByType: "account_admin",
          invitedByUserId: peterId!,
          emailType: "CUSTOMER_ACCOUNT_USER_INVITE",
          auditAction: "customer.portal_user_invited",
          actorUserId: peterId!,
        });
        await activateCustomerAccount({
          rawToken: inv.rawToken,
          password: "Transfer-Password-123!",
          firstName: email.split("@")[0],
          lastName: "User",
        });
      }

      const sophieId = await findAuthUserIdByEmail(sophieEmail);
      const markId = await findAuthUserIdByEmail(markEmail);
      expect(sophieId && markId).toBeTruthy();

      await Promise.allSettled([
        transferAccountAdmin({
          companyId: company.id,
          newUserId: sophieId as string,
          actorUserId: fixtures.staffActorId,
        }),
        transferAccountAdmin({
          companyId: company.id,
          newUserId: markId as string,
          actorUserId: fixtures.staffActorId,
        }),
      ]);

      const { count: adminCount } = await supabase
        .from("company_users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("role", "account_admin")
        .eq("status", "active");
      expect(adminCount).toBe(1);
    });
  });

  describe("existing client mirror sync (qualification)", () => {
    it("upserts ABC Facility idempotently without destructive delete", async () => {
      const externalId = `ABC-${fixtures.suffix}`;
      const supabase = createSupabaseServiceClient();
      await supabase.from("commerce_legacy_service_clients").upsert({
        external_customer_id: externalId,
        legal_name: "ABC Facility",
        display_name: "ABC Facility",
        company_status: "active",
        invoice_allowed: true,
      });

      // Scope to this row so leftover mirror data (e.g. prior E2E KVK collisions) cannot fail the gate.
      const first = await syncExistingServiceClients({
        actorUserId: fixtures.staffActorId,
        externalCustomerIds: [externalId],
      });
      expect(first.created + first.updated).toBeGreaterThan(0);

      const { count: afterFirst } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("external_customer_id", externalId);
      expect(afterFirst).toBe(1);

      await supabase
        .from("commerce_legacy_service_clients")
        .update({ display_name: "ABC Facility Updated" })
        .eq("external_customer_id", externalId);
      const second = await syncExistingServiceClients({
        actorUserId: fixtures.staffActorId,
        externalCustomerIds: [externalId],
      });
      expect(second.updated).toBeGreaterThan(0);

      const { count: afterSecond } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("external_customer_id", externalId);
      expect(afterSecond).toBe(1);

      await supabase.from("commerce_legacy_service_clients").delete().eq("external_customer_id", externalId);
      const providerRows = await new LegacyMirrorExistingCustomerProvider().listServiceClients();
      expect(providerRows.some((r) => r.externalCustomerId === externalId)).toBe(false);

      const { count: companyStillThere } = await supabase
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("external_customer_id", externalId);
      expect(companyStillThere).toBe(1);
    });
  });

  describe("portal list pagination with status filter", () => {
    it("returns consistent totals when filtering by portal status", async () => {
      const all = await listPortalCompanies({ portalStatus: "all", pageSize: 100 });
      const registration = await listPortalCompanies({
        portalStatus: "registration_required",
        pageSize: 100,
      });
      expect(registration.total).toBeLessThanOrEqual(all.total);
      expect(registration.items.every((i) => i.portalStatus === "registration_required")).toBe(true);
      expect(registration.items.length).toBeLessThanOrEqual(registration.total);
    });
  });

  describe("reminder processing", () => {
    it("creates one replacement invite and idempotent second run", async () => {
      const company = await createCompany({
        legalName: `Reminder Co ${fixtures.suffix}`,
        companyType: "service_client",
        status: "active",
        externalCustomerId: `reminder-${fixtures.suffix}`,
      });
      const invite = await createCustomerInvitation({
        companyId: company.id,
        email: `reminder-${fixtures.suffix}@qual.mccoy.test`,
        intendedRole: "account_admin",
        invitedByType: "staff",
        invitedByUserId: fixtures.staffActorId,
        emailType: "CUSTOMER_ACCOUNT_ADMIN_INVITE",
        auditAction: "customer.portal_invite_sent",
        actorUserId: fixtures.staffActorId,
      });

      const supabase = createSupabaseServiceClient();
      await supabase
        .schema("private")
        .from("customer_invitations")
        .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
        .eq("id", invite.invitationId);

      const first = await processExpiredCustomerInvitations(10);
      expect(first.expired).toBeGreaterThan(0);

      const { count: pendingAfter } = await supabase
        .schema("private")
        .from("customer_invitations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .eq("status", "pending");
      expect(pendingAfter).toBe(1);

      const second = await processExpiredCustomerInvitations(10);
      expect(second.reminders).toBe(0);
    });
  });

  describe("password reset with suspended membership", () => {
    it("allows password update but portal membership remains denied", async () => {
      const supabase = createSupabaseServiceClient();
      await supabase
        .from("company_users")
        .update({ status: "suspended" })
        .eq("company_id", fixtures.companyAId)
        .eq("user_id", fixtures.userA.userId);

      const { data: sessionData } = await createClient(config.url, config.publishableKey, {
        auth: { persistSession: false },
      }).auth.signInWithPassword({
        email: fixtures.userA.email,
        password: fixtures.userA.password,
      });

      const reset = await customerCompletePasswordReset({
        password: "New-Qual-Password-123!",
        clientKey: `qual-reset-${fixtures.suffix}`,
        accessToken: sessionData.session?.access_token,
        refreshToken: sessionData.session?.refresh_token,
      });
      expect(reset.ok).toBe(true);
      expect(await resolveCustomerMembership(fixtures.userA.userId)).toBeNull();

      const { data: reauth } = await createClient(config.url, config.publishableKey, {
        auth: { persistSession: false },
      }).auth.signInWithPassword({
        email: fixtures.userA.email,
        password: "New-Qual-Password-123!",
      });
      expect(reauth.session?.access_token).toBeTruthy();

      await supabase
        .from("company_users")
        .update({ status: "active" })
        .eq("company_id", fixtures.companyAId)
        .eq("user_id", fixtures.userA.userId);
      await supabase.auth.admin.updateUserById(fixtures.userA.userId, {
        password: fixtures.userA.password,
      });
    });
  });
});
