import { createServerFn } from "@tanstack/react-start";

import {
  acceptStaffInvitation,
  assertActiveSuperAdminActor,
  assertCanRecoverStaffAccount,
  activateStaffUser,
  completeStaffPasswordRecovery,
  completeStaffMfaRecovery,
  createStaffInvitation,
  createSupabaseServiceClient,
  decideStaffInviteForExistingEmail,
  deleteAuthTotpFactors,
  ensureStaffProfileForInvite,
  expireStaffInvitationIfNeeded,
  getActiveStaffInvitationByEmail,
  getStaffInvitationForAuthUser,
  getStaffPasswordRecoveryContext,
  getStaffMfaRecoveryContext,
  getStaffUserByEmail,
  getStaffUserById,
  isStaffInvitationAcceptable,
  isStaffMfaRecoveryInvitation,
  listStaffUsers,
  markStaffInvitationFailed,
  markStaffInvitationSent,
  staffInvitationDbErrorMessage,
  prepareStaffAccessRecovery,
  reinstateBlockedStaffUser,
  reestablishStaffSessionAfterPasswordSet,
  requireAdminSession,
  revokeActiveStaffInvitationsForEmail,
  staffInviteAuthLinkErrorMessage,
  unbanAuthUser,
  updateStaffFullName,
  writeStaffAudit,
} from "@mccoy/database/server";
import { normalizeEmail, staffPasswordStrengthError } from "@mccoy/domain";
import {
  isStaffInviteEmailConfigured,
  sendStaffAccountRecoveryEmail,
  sendStaffInviteEmail,
  sendStaffPasswordResetEmail,
  staffAuthEmailConfigErrorMessage,
} from "@mccoy/email/server";
import {
  AdminAuthError,
  assertStaffInviteAcceptRateLimit,
  assertStaffInviteRateLimit,
  assertStaffPasswordResetRateLimit,
  assertStaffRecoveryRateLimit,
  readServerEnv,
} from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  staffCompleteInviteRegistrationSchema,
  staffCompletePasswordRecoverySchema,
  staffInviteAdminSchema,
  staffRecoverAccountSchema,
  staffRequestPasswordResetSchema,
} from "@mccoy/validation";
import { resolveStaffAuthEmailLink } from "@mccoy/email/server";

/**
 * Staff identity server use cases.
 * Actor is always resolved via requireAdminSession (never trust browser-supplied user ids).
 */

async function requireActiveSuperAdmin() {
  const session = await requireAdminSession();
  const actor = session.userId ? await getStaffUserById(session.userId) : null;
  assertActiveSuperAdminActor({
    sessionUserId: session.userId,
    sessionStaffRole: session.staffRole,
    actor,
  });
  // Narrowed by assertActiveSuperAdminActor
  return { actor: actor!, session };
}

function authErrorResult(error: unknown) {
  if (error instanceof AdminAuthError) {
    return { ok: false as const, error: error.message };
  }
  throw error;
}

/**
 * Absolute redirect for Auth invite/recovery links.
 * Supabase rejects relative redirect_to values — missing `https://` produces
 * `{"error":"requested path is invalid"}` (host treated as a path on *.supabase.co).
 */
function normalizeInviteOrigin(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    const isLocal =
      /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(candidate) ||
      /^\[::1\](:\d+)?$/i.test(candidate);
    candidate = `${isLocal ? "http" : "https"}://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isAllowedInviteOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
    if (host.endsWith(".vercel.app")) return true;
    if (host === "admin.mccoy.nl" || host.endsWith(".mccoy.nl")) return true;
    const configured = normalizeInviteOrigin(readServerEnv("VITE_ADMIN_ORIGIN") || "");
    if (configured && configured === origin) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Absolute redirect for super-admin MFA account recovery links.
 * Distinct from /invite so recovery skips password and goes straight to TOTP enroll.
 */
function staffRecoverMfaRedirectUrl(preferredOrigin?: string | null): string {
  const explicitRaw = (readServerEnv("STAFF_INVITE_REDIRECT_URL") || "").trim();
  if (explicitRaw) {
    const origin = normalizeInviteOrigin(explicitRaw);
    if (origin) return `${origin}/recover-mfa`;
  }

  const preferred = preferredOrigin ? normalizeInviteOrigin(preferredOrigin) : null;
  if (preferred && isAllowedInviteOrigin(preferred)) {
    return `${preferred}/recover-mfa`;
  }

  const configured =
    normalizeInviteOrigin(readServerEnv("VITE_ADMIN_ORIGIN") || "") ||
    normalizeInviteOrigin(readServerEnv("VERCEL_URL") || "") ||
    "http://localhost:5174";
  return `${configured}/recover-mfa`;
}

/**
 * Always ends with `/invite`.
 * Never return a bare origin — that sends Auth to the app root → login.
 * If `STAFF_INVITE_REDIRECT_URL` is set to an origin only (common on Vercel),
 * we still append `/invite` (older deploys returned the env value as-is).
 */
function staffInviteRedirectUrl(preferredOrigin?: string | null): string {
  const explicitRaw = (readServerEnv("STAFF_INVITE_REDIRECT_URL") || "").trim();
  if (explicitRaw) {
    const origin = normalizeInviteOrigin(explicitRaw);
    if (origin) return `${origin}/invite`;
  }

  const preferred = preferredOrigin ? normalizeInviteOrigin(preferredOrigin) : null;
  if (preferred && isAllowedInviteOrigin(preferred)) {
    return `${preferred}/invite`;
  }

  const configured =
    normalizeInviteOrigin(readServerEnv("VITE_ADMIN_ORIGIN") || "") ||
    normalizeInviteOrigin(readServerEnv("VERCEL_URL") || "") ||
    "http://localhost:5174";
  return `${configured}/invite`;
}

function invitationAcceptErrorMessage(
  reason: "revoked" | "expired" | "failed" | "already_accepted" | "invalid_status",
): string {
  switch (reason) {
    case "expired":
      return "Deze uitnodiging is verlopen. Vraag een nieuwe uitnodiging aan.";
    case "revoked":
      return "Deze uitnodiging is ingetrokken.";
    case "failed":
      return "Deze uitnodiging is ongeldig. Vraag een nieuwe uitnodiging aan.";
    case "already_accepted":
      return "Deze uitnodiging is al geaccepteerd. Log in om verder te gaan.";
    default:
      return "Deze uitnodiging is niet meer geldig.";
  }
}

const STAFF_PASSWORD_RESET_ACK =
  "Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een resetlink.";

type StaffAuthEmailDelivery = "smtp" | "graph" | "manual_link";

/** Deliver branded staff auth mail via Graph/SMTP; never Supabase Auth SMTP. */
async function deliverStaffAuthEmail(input: {
  kind: "invite" | "recovery";
  to: string;
  actionLink: string;
  invitedByName?: string | null;
  invitedByEmail?: string | null;
  inviteeFullName?: string | null;
  expiresAt?: string | null;
}): Promise<{ delivered: boolean; delivery: StaffAuthEmailDelivery; error?: string }> {
  if (input.kind === "recovery") {
    const sent = await sendStaffPasswordResetEmail({
      to: input.to,
      resetUrl: input.actionLink,
      staffFullName: input.inviteeFullName,
    });
    if (sent.ok) {
      return { delivered: true, delivery: sent.delivery };
    }
    return { delivered: false, delivery: "manual_link", error: sent.error };
  }

  const sent = await sendStaffInviteEmail({
    to: input.to,
    inviteUrl: input.actionLink,
    invitedByName: input.invitedByName,
    invitedByEmail: input.invitedByEmail,
    inviteeFullName: input.inviteeFullName,
    expiresAt: input.expiresAt,
  });
  if (sent.ok) {
    return { delivered: true, delivery: sent.delivery };
  }
  return { delivered: false, delivery: "manual_link", error: sent.error };
}

/**
 * Build an invite/recovery action link without sending Auth mail (avoids email rate limits).
 * Prefer invite for brand-new users; fall back to recovery for existing Auth orphans.
 */
async function generateStaffInviteActionLink(input: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  email: string;
  redirectTo: string;
  userMeta: Record<string, unknown>;
}): Promise<{
  authUserId: string | null;
  actionLink: string | null;
  linkKind: "invite" | "recovery";
  errorMessage: string | null;
}> {
  const inviteLink = await input.supabase.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
      data: input.userMeta,
    },
  });
  let authUserId = inviteLink.data?.user?.id ?? null;
  let actionLink = resolveStaffAuthEmailLink({
    redirectTo: input.redirectTo,
    properties: inviteLink.data?.properties,
  });
  if (authUserId && actionLink) {
    return {
      authUserId,
      actionLink,
      linkKind: "invite",
      errorMessage: null,
    };
  }

  const recoveryLink = await input.supabase.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: { redirectTo: input.redirectTo },
  });
  authUserId = recoveryLink.data?.user?.id ?? authUserId;
  actionLink =
    resolveStaffAuthEmailLink({
      redirectTo: input.redirectTo,
      properties: recoveryLink.data?.properties,
    }) ?? actionLink;
  const errorMessage =
    recoveryLink.error?.message || inviteLink.error?.message || null;
  return {
    authUserId,
    actionLink,
    linkKind: "recovery",
    errorMessage,
  };
}

type StaffAccessRecoveryActor = {
  id: string;
  email: string;
  fullName: string | null;
};

type StaffAccessRecoveryTarget = {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: string | null;
  status: string;
  blockedAt: string | null;
};

/**
 * Shared MFA/access recovery: clear TOTP, sign out globally, set invited status,
 * revoke old invites, create invitation, generate link, send mail, audit.
 */
async function executeStaffAccessRecovery(input: {
  actor: StaffAccessRecoveryActor;
  target: StaffAccessRecoveryTarget;
  redirectTo: string;
  expiresAt: string;
  requestId?: string | null;
  emailKind: "invite" | "account-recovery";
}): Promise<
  | {
      ok: true;
      userId: string;
      invitationId: string;
      delivery: StaffAuthEmailDelivery;
      emailDelivered: boolean;
      emailError?: string;
      recoveryUrl: string | null;
      redirectTo: string;
    }
  | { ok: false; error: string }
> {
  const emailNormalized = normalizeEmail(input.target.email);

  await unbanAuthUser(input.target.id);
  await deleteAuthTotpFactors(input.target.id);
  await createSupabaseServiceClient()
    .auth.admin.signOut(input.target.id, "global")
    .catch(() => undefined);
  await prepareStaffAccessRecovery({
    userId: input.target.id,
    fullName: input.target.fullName,
  });
  await revokeActiveStaffInvitationsForEmail(emailNormalized);

  await writeStaffAudit({
    actorUserId: input.actor.id,
    action: "staff.mfa_reset",
    targetType: "user",
    targetId: input.target.id,
    before: {
      status: input.target.status,
      blocked_at: input.target.blockedAt,
      staff_role: input.target.staffRole,
    },
    after: {
      status: "invited",
      blocked_at: null,
      staff_role: input.target.staffRole,
      mfa_cleared: true,
      profile_retained: true,
    },
    requestId: input.requestId ?? null,
  });

  let invitation;
  try {
    invitation = await createStaffInvitation({
      email: input.target.email,
      invitedBy: input.actor.id,
      intendedRole: "admin",
      expiresAt: input.expiresAt,
      purpose: input.emailKind === "account-recovery" ? "mfa_recovery" : "onboard",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: staffInvitationDbErrorMessage(message, "recovery"),
    };
  }

  const supabase = createSupabaseServiceClient();
  const userMeta = {
    full_name: input.target.fullName,
    invited_by: input.actor.id,
    mccoy_staff_role: input.target.staffRole ?? "admin",
  };

  const linked = await generateStaffInviteActionLink({
    supabase,
    email: input.target.email,
    redirectTo: input.redirectTo,
    userMeta,
  });

  if (!linked.authUserId || !linked.actionLink) {
    await markStaffInvitationFailed({
      invitationId: invitation.id,
      authUserId: linked.authUserId,
      attemptCount: invitation.attempt_count + 1,
      errorCode: "auth_recovery_link_failed",
    });
    return {
      ok: false,
      error: staffInviteAuthLinkErrorMessage(linked.errorMessage),
    };
  }

  const mailed =
    input.emailKind === "account-recovery"
      ? await sendStaffAccountRecoveryEmail({
          to: input.target.email,
          recoveryUrl: linked.actionLink,
          staffFullName: input.target.fullName,
          recoveredByName: input.actor.fullName,
          recoveredByEmail: input.actor.email,
          expiresAt: input.expiresAt,
        })
      : await sendStaffInviteEmail({
          to: input.target.email,
          inviteUrl: linked.actionLink,
          invitedByName: input.actor.fullName,
          invitedByEmail: input.actor.email,
          inviteeFullName: input.target.fullName,
          expiresAt: input.expiresAt,
        });

  const emailDelivered = mailed.ok;
  const delivery: StaffAuthEmailDelivery = mailed.ok ? mailed.delivery : "manual_link";
  const mailedError = mailed.ok ? undefined : mailed.error;

  if (!emailDelivered) {
    console.warn("[executeStaffAccessRecovery] branded staff auth email failed", {
      email: emailNormalized,
      emailKind: input.emailKind,
      error: mailedError,
    });
  }

  await markStaffInvitationSent({
    invitationId: invitation.id,
    authUserId: linked.authUserId,
    attemptCount: invitation.attempt_count + 1,
  });

  await writeStaffAudit({
    actorUserId: input.actor.id,
    action: "staff.invitation_sent",
    targetType: "user",
    targetId: linked.authUserId,
    after: {
      email: emailNormalized,
      staff_role: input.target.staffRole ?? "admin",
      status: "invited",
      delivery,
      email_delivered: emailDelivered,
      account_recovery: input.emailKind === "account-recovery",
      profile_retained: true,
    },
    requestId: input.requestId ?? null,
  });

  return {
    ok: true,
    userId: linked.authUserId,
    invitationId: invitation.id,
    delivery,
    emailDelivered,
    emailError: emailDelivered ? undefined : mailedError,
    recoveryUrl: emailDelivered ? null : linked.actionLink,
    redirectTo: input.redirectTo,
  };
}

export const listStaffUsersFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await requireActiveSuperAdmin();
    const users = await listStaffUsers();
    return { ok: true as const, users };
  } catch (error) {
    return authErrorResult(error);
  }
});

export const inviteAdminFn = createServerFn({ method: "POST" })
  .validator(staffInviteAdminSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();

      if (!readServerEnv("SUPABASE_SECRET_KEY")) {
        return { ok: false as const, error: "SUPABASE_SECRET_KEY ontbreekt op de server." };
      }

      if (!isStaffInviteEmailConfigured()) {
        return { ok: false as const, error: staffAuthEmailConfigErrorMessage() };
      }

      const actor = await requireActiveSuperAdmin();
      assertStaffInviteRateLimit(actor.actor.id);

      const email = data.email.trim();
      const emailNormalized = normalizeEmail(email);
      const fullName = data.fullName?.trim() || null;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const redirectTo = staffInviteRedirectUrl(data.acceptOrigin);
      console.info("[inviteAdmin] redirectTo", redirectTo);

      const existingStaff = await getStaffUserByEmail(emailNormalized);
      const inviteDecision = decideStaffInviteForExistingEmail(existingStaff);

      if (inviteDecision === "reject_duplicate") {
        const isActiveDuplicate =
          existingStaff?.status === "active" && !existingStaff.blockedAt;
        return {
          ok: false as const,
          error: isActiveDuplicate
            ? "Dit e-mailadres hoort bij een actieve medewerker. Gebruik “Herstel account” in de medewerkerstabel als iemand MFA kwijt is."
            : "Er bestaat al een medewerker met dit e-mailadres die niet opnieuw kan worden uitgenodigd.",
        };
      }

      if (existingStaff && existingStaff.id === actor.actor.id) {
        return {
          ok: false as const,
          error: "Je kunt jezelf niet opnieuw uitnodigen. Vraag een andere super_admin om toegang te herstellen.",
        };
      }

      const isReinstate = inviteDecision === "reinstate_blocked" && existingStaff;
      const isResend = inviteDecision === "resend_invite" && existingStaff;
      const isAccessRecovery = Boolean(isReinstate);

      if (isAccessRecovery && existingStaff) {
        await unbanAuthUser(existingStaff.id);
        await deleteAuthTotpFactors(existingStaff.id);
        await createSupabaseServiceClient()
          .auth.admin.signOut(existingStaff.id, "global")
          .catch(() => undefined);
        await reinstateBlockedStaffUser({
          userId: existingStaff.id,
          fullName: fullName ?? existingStaff.fullName,
        });
        await revokeActiveStaffInvitationsForEmail(emailNormalized);
        await writeStaffAudit({
          actorUserId: actor.actor.id,
          action: "staff.unblocked",
          targetType: "user",
          targetId: existingStaff.id,
          before: {
            status: existingStaff.status,
            blocked_at: existingStaff.blockedAt,
            staff_role: existingStaff.staffRole,
          },
          after: {
            status: "invited",
            blocked_at: null,
            staff_role: existingStaff.staffRole,
            mfa_cleared: true,
            profile_retained: true,
          },
          requestId: data.requestId ?? null,
        });
      } else {
        // Open invites live in private.staff_invitations — not public.users.
        // Manual deletes in Auth/Users leave stale pending/sent rows; revoke so
        // re-invite (and intentional resend) can create a fresh invitation.
        try {
          const activeInvite = await getActiveStaffInvitationByEmail(emailNormalized);
          if (activeInvite) {
            await revokeActiveStaffInvitationsForEmail(emailNormalized);
            await writeStaffAudit({
              actorUserId: actor.actor.id,
              action: "staff.invitation_revoked",
              targetType: "staff_invitation",
              targetId: activeInvite.id,
              before: {
                email: emailNormalized,
                status: activeInvite.status,
              },
              after: {
                status: "revoked",
                reason: isResend ? "replaced_by_resend" : "replaced_by_new_invite",
              },
              requestId: data.requestId ?? null,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            ok: false as const,
            error: staffInvitationDbErrorMessage(message),
          };
        }
      }

      let invitation;
      try {
        invitation = await createStaffInvitation({
          email,
          invitedBy: actor.actor.id,
          intendedRole: "admin",
          expiresAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false as const,
          error: staffInvitationDbErrorMessage(message),
        };
      }

      await writeStaffAudit({
        actorUserId: actor.actor.id,
        action: isResend ? "staff.invitation_resent" : "staff.invitation_created",
        targetType: "staff_invitation",
        targetId: invitation.id,
        after: {
          email: emailNormalized,
          intended_role: "admin",
          reinstate: Boolean(isReinstate),
          resend: Boolean(isResend),
        },
        requestId: data.requestId ?? null,
      });

      const supabase = createSupabaseServiceClient();
      let authUserId: string | null =
        isReinstate || isResend ? existingStaff!.id : null;
      let delivery: StaffAuthEmailDelivery = "manual_link";
      let emailDelivered = false;
      let mailedError: string | undefined;
      let manualInviteUrl: string | null = null;
      const userMeta = {
        full_name: fullName,
        invited_by: actor.actor.id,
        mccoy_staff_role: existingStaff?.staffRole ?? "admin",
      };

      const linked = await generateStaffInviteActionLink({
        supabase,
        email,
        redirectTo,
        userMeta,
      });
      authUserId = linked.authUserId ?? authUserId;
      manualInviteUrl = linked.actionLink;
      if (linked.linkKind === "recovery" && !isAccessRecovery && !isResend) {
        console.warn("[inviteAdmin] invite link fell back to recovery token (Auth user may already exist)", {
          email: emailNormalized,
        });
      }

      if (!authUserId || !manualInviteUrl) {
        await markStaffInvitationFailed({
          invitationId: invitation.id,
          authUserId,
          attemptCount: invitation.attempt_count + 1,
          errorCode: isAccessRecovery ? "auth_recovery_link_failed" : "auth_invite_link_failed",
        });
        return {
          ok: false as const,
          error: staffInviteAuthLinkErrorMessage(linked.errorMessage),
        };
      }

      // Always send invite-branded mail for operator-initiated invitations (incl. reinstate/resend/MFA reset).
      // Recovery tokens may still be used when Auth rejects invite for existing users; onboarding UI
      // on /invite is driven by staff profile + invitation state, not the token type alone.
      const mailed = await deliverStaffAuthEmail({
        kind: "invite",
        to: email,
        actionLink: manualInviteUrl,
        invitedByName: actor.actor.fullName,
        invitedByEmail: actor.actor.email,
        inviteeFullName: fullName ?? existingStaff?.fullName,
        expiresAt,
      });
      delivery = mailed.delivery;
      emailDelivered = mailed.delivered;
      mailedError = mailed.error;
      if (!mailed.delivered) {
        console.warn("[inviteAdmin] branded staff auth email failed; manual link available", {
          email: emailNormalized,
          authUserId,
          reinstate: Boolean(isReinstate),
          resend: Boolean(isResend),
          error: mailed.error,
        });
      }

      if (!authUserId) {
        await markStaffInvitationFailed({
          invitationId: invitation.id,
          attemptCount: invitation.attempt_count + 1,
          errorCode: "auth_user_missing",
        });
        return {
          ok: false as const,
          error: "Uitnodiging kon niet worden verzonden. Probeer het later opnieuw.",
        };
      }

      if (!emailDelivered && manualInviteUrl) {
        delivery = "manual_link";
      }

      if (!isAccessRecovery && !isResend) {
        try {
          await ensureStaffProfileForInvite({
            id: authUserId,
            email,
            staffRole: "admin",
            status: "invited",
            fullName,
            createdBy: actor.actor.id,
          });
        } catch (profileError) {
          console.error("[inviteAdmin] profile provision failed", {
            email: emailNormalized,
            authUserId,
            error: profileError instanceof Error ? profileError.message : String(profileError),
          });
          await markStaffInvitationFailed({
            invitationId: invitation.id,
            authUserId,
            attemptCount: invitation.attempt_count + 1,
            errorCode: "profile_insert_failed",
          });
          return {
            ok: false as const,
            error: "Auth-uitnodiging aangemaakt maar profiel mislukt. Reconciliation vereist.",
            authUserId,
          };
        }
      }

      await markStaffInvitationSent({
        invitationId: invitation.id,
        authUserId,
        attemptCount: invitation.attempt_count + 1,
      });

      await writeStaffAudit({
        actorUserId: actor.actor.id,
        action: "staff.invitation_sent",
        targetType: "user",
        targetId: authUserId,
        after: {
          email: emailNormalized,
          staff_role: existingStaff?.staffRole ?? "admin",
          status: "invited",
          delivery,
          email_delivered: emailDelivered,
          reinstate: Boolean(isReinstate),
          resend: Boolean(isResend),
          profile_retained: Boolean(isAccessRecovery || isResend),
        },
        requestId: data.requestId ?? null,
      });

      return {
        ok: true as const,
        userId: authUserId,
        invitationId: invitation.id,
        delivery,
        emailDelivered,
        emailError: emailDelivered ? undefined : mailedError,
        inviteUrl: emailDelivered ? null : manualInviteUrl,
        redirectTo,
        reinstated: Boolean(isReinstate),
        resent: Boolean(isResend),
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * Super-admin MFA account recovery for active staff who lost their authenticator.
 * Distinct from new invites and blocked-account reinstate.
 */
export const recoverStaffAccountFn = createServerFn({ method: "POST" })
  .validator(staffRecoverAccountSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();

      if (!readServerEnv("SUPABASE_SECRET_KEY")) {
        return { ok: false as const, error: "SUPABASE_SECRET_KEY ontbreekt op de server." };
      }

      if (!isStaffInviteEmailConfigured()) {
        return { ok: false as const, error: staffAuthEmailConfigErrorMessage() };
      }

      const { actor, session } = await requireActiveSuperAdmin();
      assertStaffRecoveryRateLimit(actor.id);

      const target = await getStaffUserById(data.targetUserId);
      assertCanRecoverStaffAccount({
        actorUserId: actor.id,
        actorAal: session.aal,
        actor,
        target,
      });

      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const redirectTo = staffRecoverMfaRedirectUrl(data.acceptOrigin);

      const result = await executeStaffAccessRecovery({
        actor: {
          id: actor.id,
          email: actor.email,
          fullName: actor.fullName,
        },
        target: {
          id: target!.id,
          email: target!.email,
          fullName: target!.fullName,
          staffRole: target!.staffRole,
          status: target!.status,
          blockedAt: target!.blockedAt,
        },
        redirectTo,
        expiresAt,
        requestId: data.requestId ?? null,
        emailKind: "account-recovery",
      });

      if (!result.ok) {
        return result;
      }

      return {
        ok: true as const,
        userId: result.userId,
        invitationId: result.invitationId,
        delivery: result.delivery,
        emailDelivered: result.emailDelivered,
        emailError: result.emailError,
        recoveryUrl: result.recoveryUrl,
        redirectTo: result.redirectTo,
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * Invitee context after Auth invite session is established (aal1 allowed).
 */
export const getStaffInviteContextFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const session = await requireAdminSession({ allowMfaEnrollment: true });
    if (!session.userId) {
      return { ok: false as const, error: "Geen geldige sessie. Open de uitnodigingslink opnieuw." };
    }

    const profile = await getStaffUserById(session.userId);
    // Allow admin and super_admin during invite/recovery (role is retained on MFA reset).
    if (
      !profile ||
      profile.accountKind !== "staff" ||
      (profile.staffRole !== "admin" && profile.staffRole !== "super_admin")
    ) {
      return { ok: false as const, error: "Geen geldige beheerdersuitnodiging." };
    }
    if (profile.blockedAt || profile.status === "blocked") {
      return { ok: false as const, error: "Dit account is geblokkeerd." };
    }
    if (profile.status === "active" && session.aal === "aal2") {
      return {
        ok: true as const,
        alreadyComplete: true as const,
        registrationComplete: true as const,
        email: profile.email,
        fullName: profile.fullName,
        needsFullName: false,
        expiresAt: null,
      };
    }

    // Password was set outside the invite form (e.g. Admin API reset) but MFA is done:
    // activate and leave the invite shell so login is not a redirect loop.
    if (profile.status === "invited" && session.aal === "aal2") {
      try {
        await activateStaffUser(session.userId);
      } catch {
        /* non-fatal — client still proceeds to admin */
      }
      return {
        ok: true as const,
        alreadyComplete: true as const,
        registrationComplete: true as const,
        email: profile.email,
        fullName: profile.fullName,
        needsFullName: false,
        expiresAt: null,
      };
    }

    const invitation = await getStaffInvitationForAuthUser(session.userId);
    if (!invitation) {
      return { ok: false as const, error: "Geen geldige uitnodiging gevonden voor dit account." };
    }
    if (isStaffMfaRecoveryInvitation(invitation)) {
      return {
        ok: false as const,
        error:
          "Gebruik de herstellink uit je e-mail om je authenticator opnieuw in te stellen (niet de uitnodigingspagina).",
      };
    }
    const current = await expireStaffInvitationIfNeeded(invitation);

    if (current.status === "accepted" && profile.status === "invited") {
      return {
        ok: true as const,
        alreadyComplete: false as const,
        registrationComplete: true as const,
        email: profile.email,
        fullName: profile.fullName,
        needsFullName: !profile.fullName?.trim(),
        expiresAt: current.expires_at,
      };
    }

    const acceptable = isStaffInvitationAcceptable(current);
    if (!acceptable.ok) {
      return { ok: false as const, error: invitationAcceptErrorMessage(acceptable.reason) };
    }

    return {
      ok: true as const,
      alreadyComplete: false as const,
      registrationComplete: false as const,
      email: profile.email,
      fullName: profile.fullName,
      needsFullName: !profile.fullName?.trim(),
      expiresAt: current.expires_at,
    };
  } catch (error) {
    return authErrorResult(error);
  }
});

/**
 * Completes invite registration: set password (Admin API) + name + invitation accept.
 * Relies on HttpOnly cookie session from adminExchangeAuthCallback — no browser updateUser.
 */
export const completeStaffInviteRegistrationFn = createServerFn({ method: "POST" })
  .validator(staffCompleteInviteRegistrationSchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession({ allowMfaEnrollment: true });
      if (!session.userId) {
        return { ok: false as const, error: "Geen geldige sessie. Open de uitnodigingslink opnieuw." };
      }

      assertStaffInviteAcceptRateLimit(session.userId);

      const profile = await getStaffUserById(session.userId);
      if (
        !profile ||
        profile.accountKind !== "staff" ||
        (profile.staffRole !== "admin" && profile.staffRole !== "super_admin")
      ) {
        return { ok: false as const, error: "Geen geldige beheerdersuitnodiging." };
      }
      if (profile.blockedAt || profile.status === "blocked") {
        return { ok: false as const, error: "Dit account is geblokkeerd." };
      }
      if (profile.status !== "invited") {
        return {
          ok: false as const,
          error: "Registratie is al afgerond. Ga verder met inloggen of MFA.",
        };
      }

      const passwordError = staffPasswordStrengthError(data.newPassword);
      if (passwordError) {
        return { ok: false as const, error: passwordError };
      }

      let invitation = await getStaffInvitationForAuthUser(session.userId);
      if (!invitation) {
        return { ok: false as const, error: "Geen geldige uitnodiging gevonden voor dit account." };
      }
      invitation = await expireStaffInvitationIfNeeded(invitation);

      // Idempotent: registration already recorded → continue to MFA.
      if (invitation.status === "accepted") {
        const sessionRefresh = await reestablishStaffSessionAfterPasswordSet({
          email: profile.email,
          password: data.newPassword,
          clientKey: session.userId,
        });
        if (!sessionRefresh.ok) {
          return { ok: false as const, error: sessionRefresh.error };
        }
        return {
          ok: true as const,
          nextStep: "mfa_enroll" as const,
          browserHydration: sessionRefresh.browserHydration,
        };
      }

      const acceptable = isStaffInvitationAcceptable(invitation);
      if (!acceptable.ok) {
        return { ok: false as const, error: invitationAcceptErrorMessage(acceptable.reason) };
      }

      const needsFullName = !profile.fullName?.trim();
      const fullName = data.fullName?.trim() || null;
      if (needsFullName && !fullName) {
        return { ok: false as const, error: "Vul je volledige naam in." };
      }

      if (fullName && fullName !== profile.fullName) {
        await updateStaffFullName(session.userId, fullName);
      }

      const { error: passwordUpdateError } = await createSupabaseServiceClient().auth.admin.updateUserById(
        session.userId,
        {
          password: data.newPassword,
          user_metadata: {
            full_name: fullName ?? profile.fullName,
          },
        },
      );
      if (passwordUpdateError) {
        return {
          ok: false as const,
          error: passwordUpdateError.message?.trim()
            ? `Wachtwoord kon niet worden ingesteld: ${passwordUpdateError.message.trim()}`
            : "Wachtwoord kon niet worden ingesteld. Kies een sterker wachtwoord.",
        };
      }

      await writeStaffAudit({
        actorUserId: session.userId,
        action: "staff.invite_password_set",
        targetType: "user",
        targetId: session.userId,
        after: { source: "invite_registration" },
        requestId: data.requestId ?? null,
      });

      const accepted = await acceptStaffInvitation({
        invitationId: invitation.id,
        authUserId: session.userId,
      });

      await writeStaffAudit({
        actorUserId: session.userId,
        action: "staff.invitation_accepted",
        targetType: "staff_invitation",
        targetId: invitation.id,
        after: {
          auth_user_id: session.userId,
          accepted: Boolean(accepted),
          full_name_set: Boolean(fullName || profile.fullName),
        },
        requestId: data.requestId ?? null,
      });

      const sessionRefresh = await reestablishStaffSessionAfterPasswordSet({
        email: profile.email,
        password: data.newPassword,
        clientKey: session.userId,
      });
      if (!sessionRefresh.ok) {
        return { ok: false as const, error: sessionRefresh.error };
      }

      return {
        ok: true as const,
        nextStep: "mfa_enroll" as const,
        browserHydration: sessionRefresh.browserHydration,
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * Self-service password reset for active staff (login page).
 * Always returns a generic ack — no account enumeration.
 * Delivery is McCoy-owned Graph/SMTP only (generateLink + branded mail).
 */
export const requestStaffPasswordResetFn = createServerFn({ method: "POST" })
  .validator(staffRequestPasswordResetSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();

      if (!readServerEnv("SUPABASE_SECRET_KEY")) {
        return { ok: false as const, error: "SUPABASE_SECRET_KEY ontbreekt op de server." };
      }

      const email = data.email.trim();
      const emailNormalized = normalizeEmail(email);
      assertStaffPasswordResetRateLimit(emailNormalized);

      if (!isStaffInviteEmailConfigured()) {
        return { ok: false as const, error: staffAuthEmailConfigErrorMessage() };
      }

      const profile = await getStaffUserByEmail(emailNormalized);
      const isEligibleStaff =
        profile &&
        profile.accountKind === "staff" &&
        (profile.staffRole === "admin" || profile.staffRole === "super_admin") &&
        profile.status === "active" &&
        !profile.blockedAt;

      if (isEligibleStaff) {
        const redirectTo = staffInviteRedirectUrl(data.acceptOrigin);
        const supabase = createSupabaseServiceClient();
        const recoveryLink = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        const actionLink = resolveStaffAuthEmailLink({
          redirectTo,
          properties: recoveryLink.data?.properties,
        });

        if (actionLink) {
          const mailed = await deliverStaffAuthEmail({
            kind: "recovery",
            to: email,
            actionLink,
            inviteeFullName: profile.fullName,
          });
          if (!mailed.delivered) {
            console.error("[requestStaffPasswordReset] delivery failed", {
              email: emailNormalized,
              error: mailed.error,
            });
          }
        } else {
          console.error("[requestStaffPasswordReset] generateLink failed", {
            email: emailNormalized,
            error: recoveryLink.error?.message,
          });
        }
      }

      return { ok: true as const, message: STAFF_PASSWORD_RESET_ACK };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * Context for active staff completing a recovery link on /invite.
 */
export const getStaffPasswordRecoveryContextFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const result = await getStaffPasswordRecoveryContext();
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return {
      ok: true as const,
      email: result.data.email,
      fullName: result.data.fullName,
      requiresMfaCode: result.data.requiresMfaCode,
    };
  },
);

/**
 * Complete password recovery: verify MFA when enrolled, then set new password server-side.
 */
export const completeStaffPasswordRecoveryFn = createServerFn({ method: "POST" })
  .validator(staffCompletePasswordRecoverySchema)
  .handler(async ({ data }) => {
    const result = await completeStaffPasswordRecovery({
      newPassword: data.newPassword,
      totpCode: data.totpCode,
    });
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return {
      ok: true as const,
      nextStep: result.data.nextStep,
      browserHydration: result.data.browserHydration,
    };
  });

/**
 * Context for super-admin MFA account recovery on /recover-mfa.
 */
export const getStaffMfaRecoveryContextFn = createServerFn({ method: "POST" }).handler(async () => {
  const result = await getStaffMfaRecoveryContext();
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return {
    ok: true as const,
    email: result.data.email,
    fullName: result.data.fullName,
  };
});

/**
 * Complete MFA account recovery after TOTP re-enrollment (no password change).
 */
export const completeStaffMfaRecoveryFn = createServerFn({ method: "POST" }).handler(async () => {
  const result = await completeStaffMfaRecovery();
  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, redirect: result.data.redirect };
});
