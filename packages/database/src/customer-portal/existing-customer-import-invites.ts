/**
 * Auto Account Admin invites after existing-customer import.
 * Invite target = company email; contact person = invitee name hint only.
 */

import { normalizeEmail } from "@mccoy/domain";

import { getCompanyById, getUserByNormalizedEmail } from "../commerce/core";
import { createSupabaseServiceClient } from "../supabase";
import { writeStaffAudit } from "../staff";
import { CustomerPortalError } from "./errors";
import { createCustomerInvitation } from "./invitations";
import { processCommerceEmailOutbox } from "./email-worker";

export type ExistingCustomerAutoInvitePlan =
  | "will_invite"
  | "missing_email"
  | "skipped_not_new"
  | "skipped_has_admin"
  | "skipped_pending_invite";

export type ExistingCustomerAutoInviteResultStatus =
  | "sent"
  | "skipped_missing_email"
  | "skipped_not_new"
  | "skipped_has_admin"
  | "skipped_pending_invite"
  | "skipped_no_company"
  | "failed";

export type ExistingCustomerAutoInviteDetail = {
  externalCustomerId: string;
  companyId: string | null;
  email: string | null;
  status: ExistingCustomerAutoInviteResultStatus;
  reason: string | null;
  invitationId: string | null;
};

export type ExistingCustomerAutoInviteSummary = {
  sent: number;
  skipped: number;
  failed: number;
  details: ExistingCustomerAutoInviteDetail[];
};

export function splitContactPersonName(fullName: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = fullName?.trim() || "";
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function planAutoInviteForClassification(input: {
  classification: string;
  email: string | null | undefined;
}): ExistingCustomerAutoInvitePlan {
  if (input.classification !== "NEW") return "skipped_not_new";
  if (!input.email) return "missing_email";
  return "will_invite";
}

async function companyHasActiveAccountAdmin(companyId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("company_users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "account_admin")
    .eq("status", "active");
  if (error) throw new Error(`companyHasActiveAccountAdmin: ${error.message}`);
  return (count ?? 0) > 0;
}

async function companyHasPendingAccountAdminInvite(companyId: string): Promise<boolean> {
  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("intended_role", "account_admin")
    .eq("status", "pending");
  if (error) throw new Error(`companyHasPendingAccountAdminInvite: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * After mirror sync: send one Account Admin invite per NEW company with email,
 * when there is no active admin and no pending admin invite.
 */
export async function autoInviteNewImportedCompanies(input: {
  actorUserId: string;
  candidates: Array<{
    externalCustomerId: string;
    email: string | null;
    contactPersonName: string | null;
    classification: string;
  }>;
}): Promise<ExistingCustomerAutoInviteSummary> {
  const details: ExistingCustomerAutoInviteDetail[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const supabase = createSupabaseServiceClient();

  for (const candidate of input.candidates) {
    if (candidate.classification !== "NEW") {
      details.push({
        externalCustomerId: candidate.externalCustomerId,
        companyId: null,
        email: candidate.email,
        status: "skipped_not_new",
        reason: null,
        invitationId: null,
      });
      skipped += 1;
      continue;
    }

    if (!candidate.email) {
      details.push({
        externalCustomerId: candidate.externalCustomerId,
        companyId: null,
        email: null,
        status: "skipped_missing_email",
        reason: "Geen e-mailadres in import",
        invitationId: null,
      });
      skipped += 1;
      continue;
    }

    const { data: companyRow, error: companyErr } = await supabase
      .from("companies")
      .select("id")
      .eq("external_customer_id", candidate.externalCustomerId)
      .maybeSingle();
    if (companyErr) {
      details.push({
        externalCustomerId: candidate.externalCustomerId,
        companyId: null,
        email: candidate.email,
        status: "failed",
        reason: companyErr.message,
        invitationId: null,
      });
      failed += 1;
      continue;
    }

    const companyId = companyRow?.id ? String(companyRow.id) : null;
    if (!companyId) {
      details.push({
        externalCustomerId: candidate.externalCustomerId,
        companyId: null,
        email: candidate.email,
        status: "skipped_no_company",
        reason: "Bedrijf niet gevonden na sync",
        invitationId: null,
      });
      skipped += 1;
      continue;
    }

    try {
      const company = await getCompanyById(companyId);
      if (!company) {
        details.push({
          externalCustomerId: candidate.externalCustomerId,
          companyId,
          email: candidate.email,
          status: "skipped_no_company",
          reason: "Bedrijf niet gevonden na sync",
          invitationId: null,
        });
        skipped += 1;
        continue;
      }
      if (company.status !== "active") {
        details.push({
          externalCustomerId: candidate.externalCustomerId,
          companyId,
          email: candidate.email,
          status: "failed",
          reason: "Bedrijf niet actief — uitnodiging overgeslagen",
          invitationId: null,
        });
        failed += 1;
        continue;
      }

      if (await companyHasActiveAccountAdmin(companyId)) {
        details.push({
          externalCustomerId: candidate.externalCustomerId,
          companyId,
          email: candidate.email,
          status: "skipped_has_admin",
          reason: "Actieve accountbeheerder bestaat al",
          invitationId: null,
        });
        skipped += 1;
        continue;
      }

      if (await companyHasPendingAccountAdminInvite(companyId)) {
        details.push({
          externalCustomerId: candidate.externalCustomerId,
          companyId,
          email: candidate.email,
          status: "skipped_pending_invite",
          reason: "Er is al een openstaande accountbeheerder-uitnodiging",
          invitationId: null,
        });
        skipped += 1;
        continue;
      }

      const email = normalizeEmail(candidate.email);
      const existing = await getUserByNormalizedEmail(email);
      if (existing?.accountKind === "staff") {
        details.push({
          externalCustomerId: candidate.externalCustomerId,
          companyId,
          email,
          status: "failed",
          reason: "E-mail hoort bij een medewerkeraccount",
          invitationId: null,
        });
        failed += 1;
        continue;
      }

      const { firstName, lastName } = splitContactPersonName(candidate.contactPersonName);
      const invite = await createCustomerInvitation({
        companyId,
        email,
        intendedRole: "account_admin",
        invitedByType: "staff",
        invitedByUserId: input.actorUserId,
        inviteeFirstName: firstName,
        inviteeLastName: lastName,
        emailType: "CUSTOMER_ACCOUNT_ADMIN_INVITE",
        auditAction: "customer.portal_invite_sent",
        actorUserId: input.actorUserId,
        bypassRateLimit: true,
      });

      await writeStaffAudit({
        actorUserId: input.actorUserId,
        action: "commerce.existing_customer_import_auto_invite",
        targetType: "company",
        targetId: companyId,
        after: {
          externalCustomerId: candidate.externalCustomerId,
          invitationId: invite.invitationId,
          email,
        },
      }).catch(() => undefined);

      details.push({
        externalCustomerId: candidate.externalCustomerId,
        companyId,
        email,
        status: "sent",
        reason: null,
        invitationId: invite.invitationId,
      });
      sent += 1;
    } catch (err) {
      const message =
        err instanceof CustomerPortalError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      details.push({
        externalCustomerId: candidate.externalCustomerId,
        companyId,
        email: candidate.email,
        status: "failed",
        reason: message,
        invitationId: null,
      });
      failed += 1;
    }
  }

  if (sent > 0) {
    // Drain outbox in chunks so bulk import still delivers emails.
    let remaining = Math.max(sent * 2, 10);
    while (remaining > 0) {
      const batch = Math.min(25, remaining);
      const result = await processCommerceEmailOutbox(batch);
      if (result.processed <= 0 && result.failed <= 0) break;
      remaining -= result.processed + result.failed;
    }
  }

  return { sent, skipped, failed, details };
}
