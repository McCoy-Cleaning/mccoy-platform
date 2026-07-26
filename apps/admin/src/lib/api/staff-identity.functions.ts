import { createServerFn } from "@tanstack/react-start";

import {
  acceptStaffInvitation,
  assertActiveSuperAdminActor,
  createStaffInvitation,
  createSupabaseServiceClient,
  decideStaffInviteForExistingEmail,
  deleteAuthTotpFactors,
  expireStaffInvitationIfNeeded,
  getActiveStaffInvitationByEmail,
  getStaffInvitationForAuthUser,
  getStaffUserByEmail,
  getStaffUserById,
  insertStaffProfile,
  isStaffInvitationAcceptable,
  listStaffUsers,
  markStaffInvitationFailed,
  markStaffInvitationSent,
  messageIfPrivateSchemaMissing,
  reinstateBlockedStaffUser,
  requireAdminSession,
  revokeActiveStaffInvitationsForEmail,
  unbanAuthUser,
  updateStaffFullName,
  writeStaffAudit,
} from "@mccoy/database/server";
import { normalizeEmail } from "@mccoy/domain";
import {
  isStaffInviteEmailConfigured,
  sendStaffInviteEmail,
} from "@mccoy/email/server";
import {
  AdminAuthError,
  assertStaffInviteAcceptRateLimit,
  assertStaffInviteRateLimit,
  readServerEnv,
} from "@mccoy/security";
import {
  staffCompleteInviteRegistrationSchema,
  staffInviteAdminSchema,
} from "@mccoy/validation";

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
  return actor!;
}

function authErrorResult(error: unknown) {
  if (error instanceof AdminAuthError) {
    return { ok: false as const, error: error.message };
  }
  throw error;
}

function staffInviteRedirectUrl(): string {
  const explicit = readServerEnv("STAFF_INVITE_REDIRECT_URL")?.trim();
  if (explicit) return explicit;
  const origin = (readServerEnv("VITE_ADMIN_ORIGIN") || "http://localhost:5174").replace(/\/$/, "");
  return `${origin}/admin/invite`;
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
      if (!readServerEnv("SUPABASE_SECRET_KEY")) {
        return { ok: false as const, error: "SUPABASE_SECRET_KEY ontbreekt op de server." };
      }

      const actor = await requireActiveSuperAdmin();
      assertStaffInviteRateLimit(actor.id);

      const email = data.email.trim();
      const emailNormalized = normalizeEmail(email);
      const fullName = data.fullName?.trim() || null;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const redirectTo = staffInviteRedirectUrl();

      const existingStaff = await getStaffUserByEmail(emailNormalized);
      const inviteDecision = decideStaffInviteForExistingEmail(existingStaff);

      if (inviteDecision === "reject_duplicate") {
        return {
          ok: false as const,
          error: "Er bestaat al een medewerker met dit e-mailadres.",
        };
      }

      const isReinstate = inviteDecision === "reinstate_blocked" && existingStaff;

      if (isReinstate) {
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
          actorUserId: actor.id,
          action: "staff.unblocked",
          targetType: "user",
          targetId: existingStaff.id,
          before: {
            status: existingStaff.status,
            blocked_at: existingStaff.blockedAt,
          },
          after: { status: "invited", blocked_at: null },
          requestId: data.requestId ?? null,
        });
      } else {
        let activeInvite = null;
        try {
          activeInvite = await getActiveStaffInvitationByEmail(emailNormalized);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const privateHint = messageIfPrivateSchemaMissing(message);
          return {
            ok: false as const,
            error:
              privateHint ??
              "Openstaande uitnodigingen konden niet worden gecontroleerd. Probeer het later opnieuw.",
          };
        }
        if (activeInvite) {
          return {
            ok: false as const,
            error: "Er staat al een openstaande uitnodiging voor dit e-mailadres.",
          };
        }
      }

      let invitation;
      try {
        invitation = await createStaffInvitation({
          email,
          invitedBy: actor.id,
          intendedRole: "admin",
          expiresAt,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const privateHint = messageIfPrivateSchemaMissing(message);
        return {
          ok: false as const,
          error:
            privateHint ??
            "Uitnodiging kon niet worden aangemaakt. Probeer het later opnieuw.",
        };
      }

      await writeStaffAudit({
        actorUserId: actor.id,
        action: "staff.invitation_created",
        targetType: "staff_invitation",
        targetId: invitation.id,
        after: {
          email: emailNormalized,
          intended_role: "admin",
          reinstate: Boolean(isReinstate),
        },
        requestId: data.requestId ?? null,
      });

      const supabase = createSupabaseServiceClient();
      const useCustomEmail = isStaffInviteEmailConfigured();
      let authUserId: string | null = isReinstate ? existingStaff.id : null;
      let delivery: "smtp" | "supabase_auth" = "supabase_auth";
      const userMeta = {
        full_name: fullName,
        invited_by: actor.id,
        mccoy_staff_role: "admin",
      };

      if (useCustomEmail) {
        // Prefer invite link; for reinstated Auth users fall back to recovery.
        let actionLink: string | null = null;
        let linkUserId: string | null = isReinstate ? existingStaff.id : null;

        const inviteLink = await supabase.auth.admin.generateLink({
          type: "invite",
          email,
          options: { redirectTo, data: userMeta },
        });
        actionLink = inviteLink.data?.properties?.action_link ?? null;
        linkUserId = inviteLink.data?.user?.id ?? linkUserId;

        if ((!actionLink || inviteLink.error) && isReinstate) {
          const recoveryLink = await supabase.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo },
          });
          actionLink = recoveryLink.data?.properties?.action_link ?? null;
          linkUserId = recoveryLink.data?.user?.id ?? linkUserId;
        }

        authUserId = linkUserId;
        if (!authUserId || !actionLink) {
          await markStaffInvitationFailed({
            invitationId: invitation.id,
            attemptCount: invitation.attempt_count + 1,
            errorCode: "auth_generate_link_failed",
          });
          return {
            ok: false as const,
            error: "Uitnodiging kon niet worden aangemaakt. Probeer het later opnieuw.",
          };
        }

        const sent = await sendStaffInviteEmail({
          to: email,
          inviteUrl: actionLink,
          invitedByName: actor.fullName,
          invitedByEmail: actor.email,
          inviteeFullName: fullName,
          expiresAt,
        });
        if (!sent.ok) {
          await markStaffInvitationFailed({
            invitationId: invitation.id,
            authUserId,
            attemptCount: invitation.attempt_count + 1,
            errorCode: "invite_email_send_failed",
          });
          return {
            ok: false as const,
            error: "Uitnodiging kon niet worden verzonden. Probeer het later opnieuw.",
            authUserId,
          };
        }
        delivery = "smtp";
      } else if (isReinstate) {
        // inviteUserByEmail fails for existing users; Auth recovery mail + /admin/invite redirect.
        authUserId = existingStaff.id;
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (resetError) {
          await markStaffInvitationFailed({
            invitationId: invitation.id,
            authUserId,
            attemptCount: invitation.attempt_count + 1,
            errorCode: "auth_recovery_email_failed",
          });
          return {
            ok: false as const,
            error:
              "Heruitnodiging vereist e-mailverzending. Configureer SMTP (FORM_INBOX of SMTP_*) of controleer Supabase Auth mail.",
            authUserId,
          };
        }
        delivery = "supabase_auth";
      } else {
        const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
          email,
          {
            redirectTo,
            data: userMeta,
          },
        );

        if (inviteError || !invited.user) {
          await markStaffInvitationFailed({
            invitationId: invitation.id,
            attemptCount: invitation.attempt_count + 1,
            errorCode: "auth_invite_failed",
          });
          return {
            ok: false as const,
            error: "Uitnodiging kon niet worden verzonden. Probeer het later opnieuw.",
          };
        }
        authUserId = invited.user.id;
        delivery = "supabase_auth";
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

      if (!isReinstate) {
        try {
          await insertStaffProfile({
            id: authUserId,
            email,
            staffRole: "admin",
            status: "invited",
            fullName,
            createdBy: actor.id,
          });
        } catch {
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
        actorUserId: actor.id,
        action: "staff.invitation_sent",
        targetType: "user",
        targetId: authUserId,
        after: {
          email: emailNormalized,
          staff_role: "admin",
          status: "invited",
          delivery,
          reinstate: Boolean(isReinstate),
        },
        requestId: data.requestId ?? null,
      });

      return {
        ok: true as const,
        userId: authUserId,
        invitationId: invitation.id,
        delivery,
        reinstated: Boolean(isReinstate),
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
    if (!profile || profile.accountKind !== "staff" || profile.staffRole !== "admin") {
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

    const invitation = await getStaffInvitationForAuthUser(session.userId);
    if (!invitation) {
      return { ok: false as const, error: "Geen geldige uitnodiging gevonden voor dit account." };
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
 * Completes invite registration: server-side name + invitation accept + audits.
 * Password must already be set on the authenticated Auth user (browser updateUser).
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
      if (!profile || profile.accountKind !== "staff" || profile.staffRole !== "admin") {
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

      let invitation = await getStaffInvitationForAuthUser(session.userId);
      if (!invitation) {
        return { ok: false as const, error: "Geen geldige uitnodiging gevonden voor dit account." };
      }
      invitation = await expireStaffInvitationIfNeeded(invitation);

      // Idempotent: registration already recorded → continue to MFA.
      if (invitation.status === "accepted") {
        return { ok: true as const, nextStep: "mfa_enroll" as const };
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

      // Password is set by the authenticated invitee via browser updateUser.
      // We only audit that the invite registration step completed server-side.
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

      return {
        ok: true as const,
        nextStep: "mfa_enroll" as const,
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });
