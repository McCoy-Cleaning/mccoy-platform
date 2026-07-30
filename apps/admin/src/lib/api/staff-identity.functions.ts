import { createServerFn } from "@tanstack/react-start";

import {
  acceptStaffInvitation,
  assertActiveSuperAdminActor,
  activateStaffUser,
  createStaffInvitation,
  createSupabaseServiceClient,
  decideStaffInviteForExistingEmail,
  deleteAuthTotpFactors,
  ensureStaffProfileForInvite,
  expireStaffInvitationIfNeeded,
  findAuthUserIdByEmail,
  getActiveStaffInvitationByEmail,
  getStaffInvitationForAuthUser,
  getStaffUserByEmail,
  getStaffUserById,
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
 * Always ends with `/admin/invite`.
 * Never return a bare origin — that sends Auth to the app root → login.
 * If `STAFF_INVITE_REDIRECT_URL` is set to an origin only (common on Vercel),
 * we still append `/admin/invite` (older deploys returned the env value as-is).
 */
function staffInviteRedirectUrl(preferredOrigin?: string | null): string {
  const explicitRaw = (readServerEnv("STAFF_INVITE_REDIRECT_URL") || "").trim();
  if (explicitRaw) {
    const origin = normalizeInviteOrigin(explicitRaw);
    if (origin) return `${origin}/admin/invite`;
  }

  const preferred = preferredOrigin ? normalizeInviteOrigin(preferredOrigin) : null;
  if (preferred && isAllowedInviteOrigin(preferred)) {
    return `${preferred}/admin/invite`;
  }

  const configured =
    normalizeInviteOrigin(readServerEnv("VITE_ADMIN_ORIGIN") || "") ||
    normalizeInviteOrigin(readServerEnv("VERCEL_URL") || "") ||
    "http://localhost:5174";
  return `${configured}/admin/invite`;
}

/** Force `redirect_to` on Auth action links (manual CTAs / generateLink). */
function withInviteRedirectTo(actionLink: string, redirectTo: string): string {
  try {
    const url = new URL(actionLink);
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch {
    return actionLink;
  }
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

function isAuthUserAlreadyExistsError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /already (been )?registered|already exists|user already|email.*exists/i.test(message);
}

function isAuthEmailRateLimitError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /rate.?limit|email.*limit|too many.*(email|request)/i.test(message);
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
}): Promise<{ authUserId: string | null; actionLink: string | null; errorMessage: string | null }> {
  const inviteLink = await input.supabase.auth.admin.generateLink({
    type: "invite",
    email: input.email,
    options: {
      redirectTo: input.redirectTo,
      data: input.userMeta,
    },
  });
  let authUserId = inviteLink.data?.user?.id ?? null;
  let actionLink = inviteLink.data?.properties?.action_link ?? null;
  if (authUserId && actionLink) {
    return {
      authUserId,
      actionLink: withInviteRedirectTo(actionLink, input.redirectTo),
      errorMessage: null,
    };
  }

  const recoveryLink = await input.supabase.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: { redirectTo: input.redirectTo },
  });
  authUserId = recoveryLink.data?.user?.id ?? authUserId;
  actionLink = recoveryLink.data?.properties?.action_link ?? actionLink;
  const errorMessage =
    recoveryLink.error?.message || inviteLink.error?.message || null;
  return {
    authUserId,
    actionLink: actionLink ? withInviteRedirectTo(actionLink, input.redirectTo) : null,
    errorMessage,
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
      if (!readServerEnv("SUPABASE_SECRET_KEY")) {
        return { ok: false as const, error: "SUPABASE_SECRET_KEY ontbreekt op de server." };
      }

      const actor = await requireActiveSuperAdmin();
      assertStaffInviteRateLimit(actor.id);

      const email = data.email.trim();
      const emailNormalized = normalizeEmail(email);
      const fullName = data.fullName?.trim() || null;
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const redirectTo = staffInviteRedirectUrl(data.acceptOrigin);
      console.info("[inviteAdmin] redirectTo", redirectTo);

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
        // Open invites live in private.staff_invitations — not public.users.
        // Manual deletes in Auth/Users leave stale pending/sent rows; revoke so
        // re-invite (and intentional resend) can create a fresh invitation.
        try {
          const activeInvite = await getActiveStaffInvitationByEmail(emailNormalized);
          if (activeInvite) {
            await revokeActiveStaffInvitationsForEmail(emailNormalized);
            await writeStaffAudit({
              actorUserId: actor.id,
              action: "staff.invitation_revoked",
              targetType: "staff_invitation",
              targetId: activeInvite.id,
              before: {
                email: emailNormalized,
                status: activeInvite.status,
              },
              after: { status: "revoked", reason: "replaced_by_new_invite" },
              requestId: data.requestId ?? null,
            });
          }
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
      let authUserId: string | null = isReinstate ? existingStaff.id : null;
      let delivery: "smtp" | "graph" | "supabase_auth" | "manual_link" = "supabase_auth";
      let emailDelivered = true;
      let emailRateLimited = false;
      let manualInviteUrl: string | null = null;
      const userMeta = {
        full_name: fullName,
        invited_by: actor.id,
        mccoy_staff_role: "admin",
      };

      if (isReinstate) {
        // Existing Auth user: recovery mail via Supabase (primary), optional branded Graph/SMTP.
        authUserId = existingStaff.id;
        const recoveryLink = await supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
        const actionLinkRaw = recoveryLink.data?.properties?.action_link ?? null;
        const actionLink = actionLinkRaw
          ? withInviteRedirectTo(actionLinkRaw, redirectTo)
          : null;
        manualInviteUrl = actionLink;

        let brandedOk = false;
        if (actionLink && isStaffInviteEmailConfigured()) {
          const sent = await sendStaffInviteEmail({
            to: email,
            inviteUrl: actionLink,
            invitedByName: actor.fullName,
            invitedByEmail: actor.email,
            inviteeFullName: fullName,
            expiresAt,
          });
          if (sent.ok) {
            brandedOk = true;
            delivery = sent.delivery;
            emailDelivered = true;
          } else {
            console.error("[inviteAdmin] branded reinstate email failed; falling back to Auth", {
              email: emailNormalized,
              authUserId,
              error: sent.error,
            });
          }
        }

        if (!brandedOk) {
          // Do not call resetPasswordForEmail — it burns the Auth mail quota.
          // Manual recovery link is enough; optional Auth mail only when no link.
          if (actionLink) {
            emailDelivered = false;
            delivery = "manual_link";
          } else {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo,
            });
            if (resetError) {
              emailDelivered = false;
              emailRateLimited = isAuthEmailRateLimitError(resetError.message);
              delivery = "supabase_auth";
              console.error("[inviteAdmin] recovery email failed after reinstate", {
                email: emailNormalized,
                authUserId,
                error: resetError.message,
              });
            } else {
              emailDelivered = true;
              delivery = "supabase_auth";
            }
          }
        }
      } else {
        // Prefer generateLink (no Auth email) so we never burn the ~2/hour built-in
        // Supabase mail quota. inviteUserByEmail is last resort only.
        authUserId = await findAuthUserIdByEmail(email);
        emailDelivered = false;
        delivery = "manual_link";

        const linked = await generateStaffInviteActionLink({
          supabase,
          email,
          redirectTo,
          userMeta,
        });
        authUserId = linked.authUserId ?? authUserId;
        manualInviteUrl = linked.actionLink;

        if (authUserId && manualInviteUrl && isStaffInviteEmailConfigured()) {
          const branded = await sendStaffInviteEmail({
            to: email,
            inviteUrl: manualInviteUrl,
            invitedByName: actor.fullName,
            invitedByEmail: actor.email,
            inviteeFullName: fullName,
            expiresAt,
          });
          if (branded.ok) {
            delivery = branded.delivery;
            emailDelivered = true;
          } else {
            console.warn("[inviteAdmin] branded send failed; manual link ready (Auth mail skipped)", {
              email: emailNormalized,
              authUserId,
              error: branded.error,
            });
          }
        }

        // Last resort: Auth invite mail. Skipped when we already have a usable link —
        // built-in Supabase SMTP is ~2 emails/hour and often blocks external addresses.
        if (!authUserId) {
          const { data: invited, error: inviteError } =
            await supabase.auth.admin.inviteUserByEmail(email, {
              redirectTo,
              data: userMeta,
            });

          authUserId = invited?.user?.id ?? (await findAuthUserIdByEmail(email));

          if (inviteError) {
            emailDelivered = false;
            emailRateLimited = isAuthEmailRateLimitError(inviteError.message);
            console.error("[inviteAdmin] inviteUserByEmail failed", {
              email: emailNormalized,
              authUserId,
              error: inviteError.message,
              alreadyExists: isAuthUserAlreadyExistsError(inviteError.message),
              rateLimited: emailRateLimited,
            });

            if (authUserId && !manualInviteUrl) {
              const retry = await generateStaffInviteActionLink({
                supabase,
                email,
                redirectTo,
                userMeta,
              });
              manualInviteUrl = retry.actionLink;
              authUserId = retry.authUserId ?? authUserId;
            }
          } else if (authUserId) {
            emailDelivered = true;
            delivery = "supabase_auth";
          }
        }

        if (!authUserId) {
          await markStaffInvitationFailed({
            invitationId: invitation.id,
            attemptCount: invitation.attempt_count + 1,
            errorCode: emailRateLimited ? "auth_email_rate_limited" : "auth_invite_failed",
          });
          return {
            ok: false as const,
            error: emailRateLimited
              ? "Supabase Auth e-maillimiet bereikt. Stel custom SMTP in (Auth → SMTP) of Graph Mail.Send, of wacht ~1 uur."
              : linked.errorMessage ||
                "Uitnodiging kon niet worden verzonden. Probeer het later opnieuw.",
          };
        }

        if (!emailDelivered && manualInviteUrl) {
          delivery = "manual_link";
        }
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
          await ensureStaffProfileForInvite({
            id: authUserId,
            email,
            staffRole: "admin",
            status: "invited",
            fullName,
            createdBy: actor.id,
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
        actorUserId: actor.id,
        action: "staff.invitation_sent",
        targetType: "user",
        targetId: authUserId,
        after: {
          email: emailNormalized,
          staff_role: "admin",
          status: "invited",
          delivery,
          email_delivered: emailDelivered,
          email_rate_limited: emailRateLimited,
          reinstate: Boolean(isReinstate),
        },
        requestId: data.requestId ?? null,
      });

      return {
        ok: true as const,
        userId: authUserId,
        invitationId: invitation.id,
        delivery,
        emailDelivered,
        emailRateLimited,
        inviteUrl: emailDelivered ? null : manualInviteUrl,
        redirectTo,
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
