import type {
  CompanyMemberRole,
  CompanyStatus,
  CustomerPortalStatus,
} from "@mccoy/domain";

import { createSupabaseServiceClient } from "../supabase";

type InvitationPeek = {
  status: string;
  expires_at: string;
  reminder_count: number;
  last_reminder_at: string | null;
};

/**
 * Authoritative portal onboarding resolver — frontend must not duplicate this logic.
 */
export async function resolveCustomerPortalStatus(companyId: string): Promise<CustomerPortalStatus> {
  const supabase = createSupabaseServiceClient();

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("status")
    .eq("id", companyId)
    .maybeSingle();
  if (companyError) throw new Error(`resolveCustomerPortalStatus company: ${companyError.message}`);
  if (!company) return "registration_required";

  const companyStatus = company.status as CompanyStatus;
  if (companyStatus === "blocked" || companyStatus === "pending") {
    return "suspended";
  }

  const { data: memberships, error: mErr } = await supabase
    .from("company_users")
    .select("role, status, users!inner(status)")
    .eq("company_id", companyId);
  if (mErr) throw new Error(`resolveCustomerPortalStatus memberships: ${mErr.message}`);

  const rows = (memberships ?? []) as Array<{
    role: CompanyMemberRole;
    status: string;
    users: { status: string } | { status: string }[];
  }>;

  const activeAdmin = rows.find(
    (r) => r.role === "account_admin" && r.status === "active",
  );
  const anyActiveMember = rows.some((r) => r.status === "active");

  if (activeAdmin) {
    const userStatus = Array.isArray(activeAdmin.users)
      ? activeAdmin.users[0]?.status
      : activeAdmin.users?.status;
    if (userStatus === "blocked") return "suspended";
    return "active";
  }

  if (anyActiveMember) {
    return "active";
  }

  const { data: invites, error: iErr } = await supabase
    .schema("private")
    .from("customer_invitations")
    .select("status, expires_at, reminder_count, last_reminder_at")
    .eq("company_id", companyId)
    .eq("intended_role", "account_admin")
    .order("created_at", { ascending: false })
    .limit(5);
  if (iErr) throw new Error(`resolveCustomerPortalStatus invites: ${iErr.message}`);

  const pending = (invites ?? []).find((i) => i.status === "pending");
  if (pending) {
    const expiresAt = String(pending.expires_at);
    const reminderCount = Number(pending.reminder_count ?? 0);
    const expired = new Date(expiresAt).getTime() <= Date.now();
    if (expired) return "invite_expired";
    if (reminderCount > 0) return "reminder_sent";
    return "invited";
  }

  const latest = invites?.[0];
  if (latest?.status === "expired" || latest?.status === "revoked") {
    return "invite_expired";
  }

  return "registration_required";
}
