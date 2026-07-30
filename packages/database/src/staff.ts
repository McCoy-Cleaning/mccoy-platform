import type { StaffAuditAction, StaffRole, StaffUserProfile, UserStatus } from "@mccoy/domain";
import { normalizeEmail } from "@mccoy/domain";
import { createSupabaseServiceClient } from "./supabase";
import { messageIfPrivateSchemaMissing } from "./staff-policy";

type UsersRow = {
  id: string;
  account_kind: "staff" | "customer";
  staff_role: StaffRole | null;
  status: UserStatus;
  email: string;
  full_name: string | null;
  blocked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapUser(row: UsersRow): StaffUserProfile {
  return {
    id: row.id,
    accountKind: row.account_kind,
    staffRole: row.staff_role,
    status: row.status,
    email: row.email,
    fullName: row.full_name,
    blockedAt: row.blocked_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getStaffUserById(id: string): Promise<StaffUserProfile | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getStaffUserById failed: ${error.message}`);
  return data ? mapUser(data as UsersRow) : null;
}

export async function listStaffUsers(): Promise<StaffUserProfile[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("account_kind", "staff")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listStaffUsers failed: ${error.message}`);
  return ((data ?? []) as UsersRow[]).map(mapUser);
}

export async function countSuperAdmins(): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("account_kind", "staff")
    .eq("staff_role", "super_admin");
  if (error) throw new Error(`countSuperAdmins failed: ${error.message}`);
  return count ?? 0;
}

export type InsertStaffProfileInput = {
  id: string;
  email: string;
  staffRole: StaffRole;
  status?: UserStatus;
  fullName?: string | null;
  createdBy?: string | null;
};

export async function insertStaffProfile(input: InsertStaffProfileInput): Promise<StaffUserProfile> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: input.id,
      account_kind: "staff",
      staff_role: input.staffRole,
      status: input.status ?? "invited",
      email: normalizeEmail(input.email),
      full_name: input.fullName ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`insertStaffProfile failed: ${error.message}`);
  return mapUser(data as UsersRow);
}

/**
 * Insert staff profile, or return the existing row when this Auth user was already
 * provisioned (e.g. previous invite where email send failed after Auth create).
 */
export async function ensureStaffProfileForInvite(
  input: InsertStaffProfileInput,
): Promise<StaffUserProfile> {
  const existing = await getStaffUserById(input.id);
  if (existing) {
    if (normalizeEmail(existing.email) !== normalizeEmail(input.email)) {
      throw new Error("ensureStaffProfileForInvite: auth user email mismatch");
    }
    return existing;
  }
  try {
    return await insertStaffProfile(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Unique violation / race: re-read and accept if it matches.
    if (/duplicate|unique|already exists/i.test(message)) {
      const raced = await getStaffUserById(input.id);
      if (raced && normalizeEmail(raced.email) === normalizeEmail(input.email)) {
        return raced;
      }
    }
    throw error;
  }
}

/**
 * Resolve an Auth user id by email (paginated admin list).
 * Used when invite/generateLink created the user but the API returned an email error.
 */
export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient();
  const target = normalizeEmail(email);
  const perPage = 200;
  for (let page = 1; page <= 25; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`findAuthUserIdByEmail failed: ${error.message}`);
    const users = data?.users ?? [];
    const match = users.find((u) => normalizeEmail(u.email ?? "") === target);
    if (match?.id) return match.id;
    if (users.length < perPage) break;
  }
  return null;
}

export async function updateStaffFullName(
  userId: string,
  fullName: string | null,
): Promise<StaffUserProfile> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .update({ full_name: fullName })
    .eq("id", userId)
    .eq("account_kind", "staff")
    .select("*")
    .single();
  if (error) throw new Error(`updateStaffFullName failed: ${error.message}`);
  return mapUser(data as UsersRow);
}

export async function activateStaffUser(userId: string): Promise<StaffUserProfile | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .update({ status: "active" })
    .eq("id", userId)
    .eq("account_kind", "staff")
    .eq("status", "invited")
    .is("blocked_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`activateStaffUser failed: ${error.message}`);
  return data ? mapUser(data as UsersRow) : null;
}

/**
 * Soft-remove staff: set status blocked + blocked_at.
 * Prefer this over hard delete so audit/financial history stay intact.
 */
export async function blockStaffUser(userId: string): Promise<StaffUserProfile> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .update({
      status: "blocked",
      blocked_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .eq("account_kind", "staff")
    .neq("status", "blocked")
    .select("*")
    .single();
  if (error) throw new Error(`blockStaffUser failed: ${error.message}`);
  return mapUser(data as UsersRow);
}

/**
 * Secure restore after soft-block: status invited, clear blocked_at, optional name update.
 * Caller must unban Auth, revoke invites, and force MFA re-enrollment separately.
 */
export async function reinstateBlockedStaffUser(input: {
  userId: string;
  fullName?: string | null;
}): Promise<StaffUserProfile> {
  const supabase = createSupabaseServiceClient();
  const patch: {
    status: UserStatus;
    blocked_at: null;
    full_name?: string | null;
  } = {
    status: "invited",
    blocked_at: null,
  };
  if (input.fullName !== undefined) {
    patch.full_name = input.fullName;
  }
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", input.userId)
    .eq("account_kind", "staff")
    .select("*")
    .single();
  if (error) throw new Error(`reinstateBlockedStaffUser failed: ${error.message}`);
  return mapUser(data as UsersRow);
}

/** Clear Auth ban so the reinstated user can sign in via invite/recovery again. */
export async function unbanAuthUser(userId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) throw new Error(`unbanAuthUser failed: ${error.message}`);
}

/**
 * Best-effort: remove TOTP factors so reinstated staff must re-enroll MFA.
 * Soft-fails when Admin MFA API is unavailable.
 */
export async function deleteAuthTotpFactors(userId: string): Promise<number> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.auth.admin.mfa.listFactors({ userId });
    if (error || !data?.factors?.length) {
      if (error) console.warn("deleteAuthTotpFactors list failed:", error.message);
      return 0;
    }
    let deleted = 0;
    for (const factor of data.factors) {
      const result = await supabase.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId,
      });
      if (!result.error) deleted += 1;
      else console.warn("deleteAuthTotpFactors delete failed:", result.error.message);
    }
    return deleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("deleteAuthTotpFactors failed:", message);
    return 0;
  }
}

export async function countActiveSuperAdmins(): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("account_kind", "staff")
    .eq("staff_role", "super_admin")
    .eq("status", "active")
    .is("blocked_at", null);
  if (error) throw new Error(`countActiveSuperAdmins failed: ${error.message}`);
  return count ?? 0;
}

/** Active staff roster (excludes blocked/removed accounts). */
export async function listActiveStaffUsers(): Promise<StaffUserProfile[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("account_kind", "staff")
    .neq("status", "blocked")
    .is("blocked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listActiveStaffUsers failed: ${error.message}`);
  return ((data ?? []) as UsersRow[]).map(mapUser);
}

export async function writeStaffAudit(params: {
  actorUserId: string | null;
  action: StaffAuditAction;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<string> {
  // Never throw: account mutations (name/email/password) must succeed without `private`.
  try {
    const supabase = createSupabaseServiceClient();
    const { data: inserted, error: insertError } = await supabase
      .schema("private")
      .from("audit_logs")
      .insert({
        actor_user_id: params.actorUserId,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId ?? null,
        before_data: params.before ?? null,
        after_data: params.after ?? null,
        request_id: params.requestId ?? null,
        metadata: params.metadata ?? null,
      })
      .select("id")
      .single();
    if (insertError) {
      console.warn("writeStaffAudit failed:", insertError.message);
      return "";
    }
    return (inserted as { id: string }).id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("writeStaffAudit failed:", message);
    return "";
  }
}

export type CreateStaffInvitationInput = {
  email: string;
  invitedBy: string;
  intendedRole?: StaffRole;
  expiresAt?: string | null;
};

export type StaffInvitationRow = {
  id: string;
  email: string;
  email_normalized: string;
  intended_role: StaffRole;
  status: string;
  auth_user_id: string | null;
  invited_by: string;
  expires_at: string | null;
  accepted_at: string | null;
  last_error_code: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
};

export async function createStaffInvitation(input: CreateStaffInvitationInput) {
  const supabase = createSupabaseServiceClient();
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  const intendedRole = input.intendedRole ?? "admin";
  if (intendedRole !== "admin") {
    throw new Error("Only admin invitations are allowed via invite flow.");
  }

  const { data, error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .insert({
      email,
      email_normalized: emailNormalized,
      intended_role: intendedRole,
      status: "pending",
      invited_by: input.invitedBy,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();

  if (error) {
    const privateHint = messageIfPrivateSchemaMissing(error.message);
    throw new Error(
      privateHint
        ? `createStaffInvitation failed: ${privateHint}`
        : `createStaffInvitation failed: ${error.message}`,
    );
  }
  return data as StaffInvitationRow;
}

export async function getStaffUserByEmail(email: string): Promise<StaffUserProfile | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("account_kind", "staff")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw new Error(`getStaffUserByEmail failed: ${error.message}`);
  return data ? mapUser(data as UsersRow) : null;
}

export async function getActiveStaffInvitationByEmail(
  email: string,
): Promise<StaffInvitationRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .select("*")
    .eq("email_normalized", normalizeEmail(email))
    .in("status", ["pending", "sent"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveStaffInvitationByEmail failed: ${error.message}`);
  return (data as StaffInvitationRow | null) ?? null;
}

export async function getStaffInvitationForAuthUser(
  authUserId: string,
): Promise<StaffInvitationRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .select("*")
    .eq("auth_user_id", authUserId)
    .in("status", ["pending", "sent", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getStaffInvitationForAuthUser failed: ${error.message}`);
  return (data as StaffInvitationRow | null) ?? null;
}

export async function markStaffInvitationSent(input: {
  invitationId: string;
  authUserId: string;
  attemptCount: number;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .update({
      status: "sent",
      auth_user_id: input.authUserId,
      attempt_count: input.attemptCount,
      last_error_code: null,
    })
    .eq("id", input.invitationId);
  if (error) throw new Error(`markStaffInvitationSent failed: ${error.message}`);
}

export async function markStaffInvitationFailed(input: {
  invitationId: string;
  authUserId?: string | null;
  attemptCount: number;
  errorCode: string;
}): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .update({
      status: "failed",
      auth_user_id: input.authUserId ?? null,
      attempt_count: input.attemptCount,
      last_error_code: input.errorCode,
    })
    .eq("id", input.invitationId);
  if (error) throw new Error(`markStaffInvitationFailed failed: ${error.message}`);
}

/** Revoke pending/sent invitations for an email (e.g. when staff is removed). */
export async function revokeActiveStaffInvitationsForEmail(email: string): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const emailNormalized = normalizeEmail(email);
  const { data, error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .update({ status: "revoked" })
    .eq("email_normalized", emailNormalized)
    .in("status", ["pending", "sent"])
    .select("id");
  if (error) {
    console.warn("revokeActiveStaffInvitationsForEmail failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export function isStaffInvitationAcceptable(invitation: StaffInvitationRow): {
  ok: true;
} | { ok: false; reason: "revoked" | "expired" | "failed" | "already_accepted" | "invalid_status" } {
  if (invitation.status === "accepted") {
    return { ok: false, reason: "already_accepted" };
  }
  if (invitation.status === "revoked") {
    return { ok: false, reason: "revoked" };
  }
  if (invitation.status === "failed") {
    return { ok: false, reason: "failed" };
  }
  if (invitation.status === "expired") {
    return { ok: false, reason: "expired" };
  }
  if (invitation.status !== "pending" && invitation.status !== "sent") {
    return { ok: false, reason: "invalid_status" };
  }
  if (invitation.expires_at) {
    const expires = new Date(invitation.expires_at).getTime();
    if (!Number.isNaN(expires) && expires < Date.now()) {
      return { ok: false, reason: "expired" };
    }
  }
  return { ok: true };
}

export async function acceptStaffInvitation(input: {
  invitationId: string;
  authUserId: string;
}): Promise<StaffInvitationRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      auth_user_id: input.authUserId,
    })
    .eq("id", input.invitationId)
    .in("status", ["pending", "sent"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`acceptStaffInvitation failed: ${error.message}`);
  return (data as StaffInvitationRow | null) ?? null;
}

/** Best-effort: mark timed-out pending/sent invites as expired. */
export async function expireStaffInvitationIfNeeded(
  invitation: StaffInvitationRow,
): Promise<StaffInvitationRow> {
  const check = isStaffInvitationAcceptable(invitation);
  if (check.ok || check.reason !== "expired" || invitation.status === "expired") {
    return invitation;
  }
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .schema("private")
    .from("staff_invitations")
    .update({ status: "expired" })
    .eq("id", invitation.id)
    .in("status", ["pending", "sent"])
    .select("*")
    .maybeSingle();
  if (error || !data) return { ...invitation, status: "expired" };
  return data as StaffInvitationRow;
}
