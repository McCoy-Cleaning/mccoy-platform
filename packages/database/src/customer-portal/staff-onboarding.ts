import { normalizeEmail } from "@mccoy/domain";

import { getCompanyById, getUserByNormalizedEmail } from "../commerce/core";
import { CustomerPortalError } from "./errors";
import { assertActorIsCompanyAccountAdmin } from "./membership";
import { createCustomerInvitation } from "./invitations";
import { processCommerceEmailOutbox } from "./email-worker";

export async function staffInviteAccountAdmin(input: {
  companyId: string;
  email: string;
  actorUserId: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<{ invitationId: string; expiresAt: string }> {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new CustomerPortalError("Bedrijf niet gevonden.", "CUSTOMER_CROSS_TENANT_DENIED");
  if (company.status !== "active") {
    throw new CustomerPortalError("Bedrijf niet beschikbaar.", "CUSTOMER_COMPANY_SUSPENDED");
  }

  const email = normalizeEmail(input.email);
  if (!email) throw new CustomerPortalError("E-mail verplicht.", "CUSTOMER_INVITE_INVALID");

  const existing = await getUserByNormalizedEmail(email);
  if (existing?.accountKind === "staff") {
    throw new CustomerPortalError("Medewerkeraccount.", "CUSTOMER_STAFF_COLLISION");
  }

  const result = await createCustomerInvitation({
    companyId: input.companyId,
    email,
    intendedRole: "account_admin",
    invitedByType: "staff",
    invitedByUserId: input.actorUserId,
    inviteeFirstName: input.firstName,
    inviteeLastName: input.lastName,
    emailType: "CUSTOMER_ACCOUNT_ADMIN_INVITE",
    auditAction: "customer.portal_invite_sent",
    actorUserId: input.actorUserId,
  });

  await processCommerceEmailOutbox(5);
  return { invitationId: result.invitationId, expiresAt: result.expiresAt };
}

export async function staffInviteAccountUser(input: {
  companyId: string;
  email: string;
  actorUserId: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}): Promise<{ invitationId: string; expiresAt: string }> {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new CustomerPortalError("Bedrijf niet gevonden.", "CUSTOMER_CROSS_TENANT_DENIED");
  if (company.status !== "active") {
    throw new CustomerPortalError("Bedrijf niet beschikbaar.", "CUSTOMER_COMPANY_SUSPENDED");
  }

  const email = normalizeEmail(input.email);
  if (!email) throw new CustomerPortalError("E-mail verplicht.", "CUSTOMER_INVITE_INVALID");

  const existing = await getUserByNormalizedEmail(email);
  if (existing?.accountKind === "staff") {
    throw new CustomerPortalError("Medewerkeraccount.", "CUSTOMER_STAFF_COLLISION");
  }

  const result = await createCustomerInvitation({
    companyId: input.companyId,
    email,
    intendedRole: "account_user",
    invitedByType: "staff",
    invitedByUserId: input.actorUserId,
    inviteeFirstName: input.firstName,
    inviteeLastName: input.lastName,
    inviteePhone: input.phone,
    emailType: "CUSTOMER_ACCOUNT_USER_INVITE",
    auditAction: "customer.portal_user_invited",
    actorUserId: input.actorUserId,
  });

  await processCommerceEmailOutbox(5);
  return { invitationId: result.invitationId, expiresAt: result.expiresAt };
}

export async function accountAdminInviteUser(input: {
  companyId: string;
  email: string;
  actorUserId: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}): Promise<{ invitationId: string; expiresAt: string }> {
  await assertActorIsCompanyAccountAdmin(input.companyId, input.actorUserId);

  const email = normalizeEmail(input.email);
  if (!email) throw new CustomerPortalError("E-mail verplicht.", "CUSTOMER_INVITE_INVALID");

  const existing = await getUserByNormalizedEmail(email);
  if (existing?.accountKind === "staff") {
    throw new CustomerPortalError("Medewerkeraccount.", "CUSTOMER_STAFF_COLLISION");
  }

  const result = await createCustomerInvitation({
    companyId: input.companyId,
    email,
    intendedRole: "account_user",
    invitedByType: "account_admin",
    invitedByUserId: input.actorUserId,
    inviteeFirstName: input.firstName,
    inviteeLastName: input.lastName,
    inviteePhone: input.phone,
    emailType: "CUSTOMER_ACCOUNT_USER_INVITE",
    auditAction: "customer.portal_user_invited",
    actorUserId: input.actorUserId,
  });

  await processCommerceEmailOutbox(5);
  return { invitationId: result.invitationId, expiresAt: result.expiresAt };
}

export async function resendPortalInvitation(input: {
  companyId: string;
  email: string;
  intendedRole: "account_admin" | "account_user";
  actorUserId: string;
  invitedByType: "staff" | "account_admin";
}): Promise<{ invitationId: string; expiresAt: string }> {
  const result = await createCustomerInvitation({
    companyId: input.companyId,
    email: input.email,
    intendedRole: input.intendedRole,
    invitedByType: input.invitedByType,
    invitedByUserId: input.actorUserId,
    emailType:
      input.intendedRole === "account_admin"
        ? "CUSTOMER_ACCOUNT_ADMIN_INVITE"
        : "CUSTOMER_ACCOUNT_USER_INVITE",
    auditAction: "customer.portal_invite_resent",
    actorUserId: input.actorUserId,
  });
  await processCommerceEmailOutbox(5);
  return { invitationId: result.invitationId, expiresAt: result.expiresAt };
}
