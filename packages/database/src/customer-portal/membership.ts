import { writeStaffAudit } from "../staff";
import { createSupabaseServiceClient } from "../supabase";
import { CustomerPortalError } from "./errors";

export async function assertActorIsCompanyAccountAdmin(companyId: string, actorUserId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_users")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (error) throw new Error(`assertActorIsCompanyAccountAdmin: ${error.message}`);
  if (!data || data.role !== "account_admin" || data.status !== "active") {
    throw new CustomerPortalError("Accountbeheerder vereist.", "CUSTOMER_ADMIN_REQUIRED");
  }
}

export async function suspendCompanyMembership(input: {
  companyId: string;
  userId: string;
  actorUserId: string | null;
}): Promise<void> {
  if (input.actorUserId) {
    await assertActorIsCompanyAccountAdmin(input.companyId, input.actorUserId);
  }
  const supabase = createSupabaseServiceClient();
  const { data: row, error: fetchError } = await supabase
    .from("company_users")
    .select("role, status")
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (fetchError) throw new Error(`suspendCompanyMembership fetch: ${fetchError.message}`);
  if (!row) throw new CustomerPortalError("Gebruiker niet gevonden.", "CUSTOMER_CROSS_TENANT_DENIED");
  if (row.role === "account_admin") {
    throw new CustomerPortalError("Accountbeheerder kan niet worden opgeschort.", "CUSTOMER_ADMIN_REQUIRED");
  }

  const { error } = await supabase
    .from("company_users")
    .update({ status: "suspended" })
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`suspendCompanyMembership: ${error.message}`);

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "customer.membership_suspended",
    targetType: "user",
    targetId: input.userId,
    after: { companyId: input.companyId },
  });
}

export async function reactivateCompanyMembership(input: {
  companyId: string;
  userId: string;
  actorUserId: string | null;
}): Promise<void> {
  if (input.actorUserId) {
    await assertActorIsCompanyAccountAdmin(input.companyId, input.actorUserId);
  }
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("company_users")
    .update({ status: "active" })
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`reactivateCompanyMembership: ${error.message}`);

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "customer.membership_reactivated",
    targetType: "user",
    targetId: input.userId,
    after: { companyId: input.companyId },
  });
}

export async function staffSuspendCompanyMembership(input: {
  companyId: string;
  userId: string;
  actorUserId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { data: row, error: fetchError } = await supabase
    .from("company_users")
    .select("role, status")
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (fetchError) throw new Error(`staffSuspendCompanyMembership fetch: ${fetchError.message}`);
  if (!row) throw new CustomerPortalError("Gebruiker niet gevonden.", "CUSTOMER_CROSS_TENANT_DENIED");
  if (row.role === "account_admin") {
    throw new CustomerPortalError(
      "Accountbeheerder kan niet worden opgeschort. Draag eerst beheer over.",
      "CUSTOMER_ADMIN_REQUIRED",
    );
  }

  const { error } = await supabase
    .from("company_users")
    .update({ status: "suspended" })
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`staffSuspendCompanyMembership: ${error.message}`);

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "customer.membership_suspended",
    targetType: "user",
    targetId: input.userId,
    after: { companyId: input.companyId, by: "staff" },
  });
}

export async function staffReactivateCompanyMembership(input: {
  companyId: string;
  userId: string;
  actorUserId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("company_users")
    .update({ status: "active" })
    .eq("company_id", input.companyId)
    .eq("user_id", input.userId);
  if (error) throw new Error(`staffReactivateCompanyMembership: ${error.message}`);

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "customer.membership_reactivated",
    targetType: "user",
    targetId: input.userId,
    after: { companyId: input.companyId, by: "staff" },
  });
}

export async function transferAccountAdmin(input: {
  companyId: string;
  newUserId: string;
  actorUserId: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.rpc("transfer_company_account_admin", {
    p_company_id: input.companyId,
    p_new_user_id: input.newUserId,
    p_actor_user_id: input.actorUserId,
  });
  if (error) throw new Error(`transferAccountAdmin: ${error.message}`);

  await writeStaffAudit({
    actorUserId: input.actorUserId,
    action: "customer.account_admin_transferred",
    targetType: "company",
    targetId: input.companyId,
    after: { newAdminUserId: input.newUserId },
  });
}

export async function listCompanyMemberships(companyId: string): Promise<
  Array<{
    userId: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: string;
    membershipStatus: string;
    userStatus: string;
  }>
> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("company_users")
    .select("user_id, role, status, users!inner(email, full_name, phone, status)")
    .eq("company_id", companyId);
  if (error) throw new Error(`listCompanyMemberships: ${error.message}`);

  return (data ?? []).map((row) => {
    const usersRaw = row.users as
      | { email: string; full_name: string | null; phone: string | null; status: string }
      | Array<{ email: string; full_name: string | null; phone: string | null; status: string }>;
    const users = Array.isArray(usersRaw) ? usersRaw[0] : usersRaw;
    return {
      userId: row.user_id as string,
      email: users?.email ?? "",
      fullName: users?.full_name ?? null,
      phone: users?.phone ?? null,
      role: row.role as string,
      membershipStatus: row.status as string,
      userStatus: users?.status ?? "active",
    };
  });
}
