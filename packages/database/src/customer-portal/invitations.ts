import { normalizeEmail, type CompanyMemberRole } from "@mccoy/domain";
import {
  CUSTOMER_INVITE_RATE,
  assertRateLimit,
  RateLimitError,
} from "@mccoy/security";

import { writeStaffAudit } from "../staff";
import { createSupabaseServiceClient } from "../supabase";
import { customerInviteTtlHours } from "./config";
import { CustomerPortalError } from "./errors";
import { enqueueCommerceEmailOutbox } from "./email-outbox";
import { generateInvitationToken, hashInvitationToken } from "./tokens";

export type CustomerInvitationRow = {
  id: string;
  companyId: string;
  email: string;
  emailNormalized: string;
  intendedRole: CompanyMemberRole;
  status: "pending" | "consumed" | "expired" | "revoked";
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
  invitedByType: "staff" | "account_admin";
  invitedByUserId: string | null;
  inviteeFirstName: string | null;
  inviteeLastName: string | null;
  inviteePhone: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapInvitation(row: Record<string, unknown>): CustomerInvitationRow {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    email: String(row.email),
    emailNormalized: String(row.email_normalized),
    intendedRole: row.intended_role as CompanyMemberRole,
    status: row.status as CustomerInvitationRow["status"],
    expiresAt: String(row.expires_at),
    consumedAt: (row.consumed_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    invitedByType: row.invited_by_type as "staff" | "account_admin",
    invitedByUserId: (row.invited_by_user_id as string | null) ?? null,
    inviteeFirstName: (row.invitee_first_name as string | null) ?? null,
    inviteeLastName: (row.invitee_last_name as string | null) ?? null,
    inviteePhone: (row.invitee_phone as string | null) ?? null,
    reminderCount: Number(row.reminder_count ?? 0),
    lastReminderAt: (row.last_reminder_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function expiresAtFromNow(): string {
  const hours = customerInviteTtlHours();
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function revokePendingInvitations(input: {
  companyId: string;
  emailNormalized: string;
  intendedRole: CompanyMemberRole;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  if (input.intendedRole === "account_admin") {
    const { error: adminErr } = await supabase
      .schema("private")
      .from("customer_invitations")
      .update({ status: "revoked", revoked_at: now })
      .eq("company_id", input.companyId)
      .eq("intended_role", "account_admin")
      .eq("status", "pending");
    if (adminErr) throw new Error(`revokePendingAdminInvitations: ${adminErr.message}`);
    return;
  }

  const { error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .update({ status: "revoked", revoked_at: now })
    .eq("company_id", input.companyId)
    .eq("email_normalized", input.emailNormalized)
    .eq("intended_role", input.intendedRole)
    .eq("status", "pending");
  if (error) throw new Error(`revokePendingInvitations: ${error.message}`);
}

async function assertAccountAdminInviteAllowed(
  companyId: string,
  options: { allowWhileActiveAdmin?: boolean } = {},
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const { count: activeAdminCount, error: adminErr } = await supabase
    .from("company_users")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("role", "account_admin")
    .eq("status", "active");
  if (adminErr) throw new Error(`assertAccountAdminInviteAllowed: ${adminErr.message}`);

  if ((activeAdminCount ?? 0) > 0 && !options.allowWhileActiveAdmin) {
    throw new CustomerPortalError(
      "Er is al een actieve accountbeheerder. Gebruik de transfer-flow om te vervangen.",
      "CUSTOMER_ADMIN_ALREADY_EXISTS",
    );
  }
}

export type CreateCustomerInvitationInput = {
  companyId: string;
  email: string;
  intendedRole: CompanyMemberRole;
  invitedByType: "staff" | "account_admin";
  invitedByUserId: string | null;
  inviteeFirstName?: string | null;
  inviteeLastName?: string | null;
  inviteePhone?: string | null;
  emailType: string;
  auditAction: import("@mccoy/domain").StaffAuditAction;
  actorUserId: string | null;
  /**
   * Trusted server bulk paths only (e.g. existing-customer import auto-invite).
   * Never expose to browser-controlled handlers.
   */
  bypassRateLimit?: boolean;
};

export type CreateCustomerInvitationResult = {
  invitationId: string;
  expiresAt: string;
  /** Only for email delivery — never persist or return to staff UI after enqueue. */
  rawToken: string;
};

/**
 * Replace pending invitation for same target and enqueue email in durable outbox.
 */
export async function createCustomerInvitation(
  input: CreateCustomerInvitationInput,
): Promise<CreateCustomerInvitationResult> {
  const emailNormalized = normalizeEmail(input.email);
  if (!emailNormalized) {
    throw new CustomerPortalError("E-mailadres is verplicht.", "CUSTOMER_INVITE_INVALID");
  }

  if (input.intendedRole === "account_admin" && input.invitedByType !== "staff") {
    throw new CustomerPortalError("Alleen McCoy kan een accountbeheerder uitnodigen.", "CUSTOMER_ADMIN_REQUIRED");
  }

  if (input.intendedRole === "account_admin") {
    await assertAccountAdminInviteAllowed(input.companyId);
  }

  const rateKey = input.actorUserId ?? input.invitedByUserId ?? input.companyId;
  if (!input.bypassRateLimit) {
    try {
      assertRateLimit(
        `${CUSTOMER_INVITE_RATE.keyPrefix}:${rateKey}`,
        CUSTOMER_INVITE_RATE.maxAttempts,
        CUSTOMER_INVITE_RATE.windowMs,
      );
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
      if (error instanceof RateLimitError || code === "rate_limit") {
        throw new CustomerPortalError(
          "Te veel uitnodigingen. Probeer het later opnieuw.",
          "CUSTOMER_INVITE_RATE_LIMITED",
        );
      }
      throw error;
    }
  }

  const supabase = createSupabaseServiceClient();
  const rawToken = generateInvitationToken();
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = expiresAtFromNow();

  await revokePendingInvitations({
    companyId: input.companyId,
    emailNormalized,
    intendedRole: input.intendedRole,
  });

  const { data, error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .insert({
      company_id: input.companyId,
      email: input.email.trim(),
      email_normalized: emailNormalized,
      intended_role: input.intendedRole,
      token_hash: tokenHash,
      status: "pending",
      expires_at: expiresAt,
      invited_by_type: input.invitedByType,
      invited_by_user_id: input.invitedByUserId,
      invitee_first_name: input.inviteeFirstName?.trim() || null,
      invitee_last_name: input.inviteeLastName?.trim() || null,
      invitee_phone: input.inviteePhone?.trim() || null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new CustomerPortalError("Er is al een openstaande uitnodiging.", "CUSTOMER_ALREADY_ACTIVE");
    }
    throw new Error(`createCustomerInvitation: ${error.message}`);
  }

  const invitation = mapInvitation(data as Record<string, unknown>);

  await enqueueCommerceEmailOutbox({
    emailType: input.emailType,
    toEmailNormalized: emailNormalized,
    invitationId: invitation.id,
    dedupeKey: `invite:${invitation.id}`,
    payload: {
      invitationId: invitation.id,
      companyId: input.companyId,
      intendedRole: input.intendedRole,
      rawToken,
      expiresAt,
      inviteeFirstName: input.inviteeFirstName,
      inviteeLastName: input.inviteeLastName,
    },
  });

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: input.auditAction,
    targetType: "company",
    targetId: input.companyId,
    after: {
      invitationId: invitation.id,
      email: emailNormalized,
      intendedRole: input.intendedRole,
      expiresAt,
    },
  });

  return { invitationId: invitation.id, expiresAt, rawToken };
}

export async function getInvitationByTokenHash(tokenHash: string): Promise<CustomerInvitationRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(`getInvitationByTokenHash: ${error.message}`);
  if (!data) return null;
  return mapInvitation(data as Record<string, unknown>);
}

export async function peekInvitationByRawToken(rawToken: string): Promise<{
  ok: true;
  email: string;
  companyName: string;
  expiresAt: string;
} | {
  ok: false;
  code: "CUSTOMER_INVITE_INVALID" | "CUSTOMER_INVITE_EXPIRED" | "CUSTOMER_INVITE_REVOKED" | "CUSTOMER_INVITE_USED";
}> {
  const tokenHash = hashInvitationToken(rawToken.trim());
  const invitation = await getInvitationByTokenHash(tokenHash);
  if (!invitation) return { ok: false, code: "CUSTOMER_INVITE_INVALID" };
  if (invitation.status === "consumed") return { ok: false, code: "CUSTOMER_INVITE_USED" };
  if (invitation.status === "revoked") return { ok: false, code: "CUSTOMER_INVITE_REVOKED" };
  if (invitation.status === "expired") return { ok: false, code: "CUSTOMER_INVITE_EXPIRED" };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return { ok: false, code: "CUSTOMER_INVITE_EXPIRED" };
  }

  const supabase = createSupabaseServiceClient();
  const { data: company } = await supabase
    .from("companies")
    .select("legal_name, display_name")
    .eq("id", invitation.companyId)
    .maybeSingle();

  const companyName =
    (company?.display_name as string | null) ||
    (company?.legal_name as string) ||
    "Uw bedrijf";

  return {
    ok: true,
    email: invitation.email,
    companyName,
    expiresAt: invitation.expiresAt,
  };
}

export async function listPendingInvitationsForCompany(companyId: string): Promise<CustomerInvitationRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listPendingInvitationsForCompany: ${error.message}`);
  return (data ?? []).map((row) => mapInvitation(row as Record<string, unknown>));
}

export async function listInvitationsForCompany(companyId: string): Promise<CustomerInvitationRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`listInvitationsForCompany: ${error.message}`);
  return (data ?? []).map((row) => mapInvitation(row as Record<string, unknown>));
}
