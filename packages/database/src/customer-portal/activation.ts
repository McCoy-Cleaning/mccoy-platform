import { normalizeEmail, type CompanyMemberRole } from "@mccoy/domain";

import {
  getUserByNormalizedEmail,
  insertCustomerProfile,
  updateCustomerProfile,
} from "../commerce/core";
import { findAuthUserIdByEmail } from "../staff";
import { writeStaffAudit } from "../staff";
import { createSupabaseServiceClient } from "../supabase";
import { CustomerPortalError } from "./errors";
import { getInvitationByTokenHash, type CustomerInvitationRow } from "./invitations";
import { hashInvitationToken } from "./tokens";

export type ActivateCustomerAccountInput = {
  rawToken: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export type ActivateCustomerAccountResult = {
  ok: true;
  userId: string;
  companyId: string;
};

async function assertInviteEligible(invitation: CustomerInvitationRow): Promise<void> {
  if (invitation.status === "consumed") {
    throw new CustomerPortalError("Uitnodiging al gebruikt.", "CUSTOMER_INVITE_USED");
  }
  if (invitation.status === "revoked") {
    throw new CustomerPortalError("Uitnodiging ingetrokken.", "CUSTOMER_INVITE_REVOKED");
  }
  if (invitation.status === "expired") {
    throw new CustomerPortalError("Uitnodiging verlopen.", "CUSTOMER_INVITE_EXPIRED");
  }
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    throw new CustomerPortalError("Uitnodiging verlopen.", "CUSTOMER_INVITE_EXPIRED");
  }
}

async function assertEmailCollisions(
  emailNormalized: string,
  companyId: string,
): Promise<void> {
  const existing = await getUserByNormalizedEmail(emailNormalized);
  if (existing?.accountKind === "staff") {
    throw new CustomerPortalError("Medewerkeraccount.", "CUSTOMER_STAFF_COLLISION");
  }

  if (existing?.accountKind === "customer") {
    const supabase = createSupabaseServiceClient();
    const { data: memberships } = await supabase
      .from("company_users")
      .select("company_id, status")
      .eq("user_id", existing.id);

    for (const m of memberships ?? []) {
      const otherCompany = m.company_id as string;
      if (otherCompany !== companyId && m.status === "active") {
        throw new CustomerPortalError("Al gekoppeld aan ander bedrijf.", "CUSTOMER_OTHER_COMPANY");
      }
    }
  }
}

/**
 * Race-safe activation: locks invitation row via status transition.
 */
export async function activateCustomerAccount(
  input: ActivateCustomerAccountInput,
): Promise<ActivateCustomerAccountResult> {
  const tokenHash = hashInvitationToken(input.rawToken.trim());
  const invitation = await getInvitationByTokenHash(tokenHash);
  if (!invitation) {
    throw new CustomerPortalError("Ongeldige link.", "CUSTOMER_INVITE_INVALID");
  }

  await assertInviteEligible(invitation);
  await assertEmailCollisions(invitation.emailNormalized, invitation.companyId);

  const supabase = createSupabaseServiceClient();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("status")
    .eq("id", invitation.companyId)
    .maybeSingle();
  if (companyError) throw new Error(`activateCustomerAccount company: ${companyError.message}`);
  if (!company || company.status !== "active") {
    throw new CustomerPortalError("Bedrijf niet beschikbaar.", "CUSTOMER_COMPANY_SUSPENDED");
  }

  if (invitation.intendedRole === "account_admin") {
    const { count } = await supabase
      .from("company_users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", invitation.companyId)
      .eq("role", "account_admin")
      .eq("status", "active");
    if ((count ?? 0) > 0) {
      throw new CustomerPortalError("Accountbeheerder bestaat al.", "CUSTOMER_ADMIN_ALREADY_EXISTS");
    }
  }

  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();
  const email = invitation.emailNormalized;

  let authUserId = await findAuthUserIdByEmail(email);
  if (!authUserId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        account_kind: "customer",
        full_name: fullName,
      },
    });
    if (error || !data.user?.id) {
      authUserId = await findAuthUserIdByEmail(email);
      if (!authUserId) {
        throw new Error(error?.message || "Auth-gebruiker aanmaken mislukt.");
      }
      await supabase.auth.admin.updateUserById(authUserId, { password: input.password });
    } else {
      authUserId = data.user.id;
    }
  } else {
    await supabase.auth.admin.updateUserById(authUserId, {
      password: input.password,
      email_confirm: true,
    });
  }

  const existingProfile = await getUserByNormalizedEmail(email);
  if (!existingProfile) {
    await insertCustomerProfile({
      id: authUserId,
      email,
      fullName,
      phone: input.phone?.trim() || invitation.inviteePhone,
      status: "active",
      createdBy: invitation.invitedByUserId,
    });
  } else {
    await updateCustomerProfile(authUserId, {
      fullName,
      phone: input.phone?.trim() || invitation.inviteePhone,
    });
    const supabase2 = createSupabaseServiceClient();
    await supabase2.from("users").update({ status: "active" }).eq("id", authUserId);
  }

  const { error: memberError } = await supabase.from("company_users").upsert(
    {
      company_id: invitation.companyId,
      user_id: authUserId,
      role: invitation.intendedRole,
      status: "active",
    },
    { onConflict: "company_id,user_id" },
  );
  if (memberError) throw new Error(`activateCustomerAccount membership: ${memberError.message}`);

  const now = new Date().toISOString();
  const { data: consumed, error: consumeError } = await supabase
    .schema("private")
    .from("customer_invitations")
    .update({ status: "consumed", consumed_at: now })
    .eq("id", invitation.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (consumeError) throw new Error(`activateCustomerAccount consume: ${consumeError.message}`);
  if (!consumed) {
    throw new CustomerPortalError("Uitnodiging al gebruikt.", "CUSTOMER_INVITE_USED");
  }

  await writeStaffAudit({
    actorUserId: authUserId,
    action: "customer.portal_activated",
    targetType: "user",
    targetId: authUserId,
    after: {
      companyId: invitation.companyId,
      role: invitation.intendedRole,
      invitationId: invitation.id,
    },
  });

  return { ok: true, userId: authUserId, companyId: invitation.companyId };
}
