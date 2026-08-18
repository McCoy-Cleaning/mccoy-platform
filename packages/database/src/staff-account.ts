import { createClient } from "@supabase/supabase-js";

import {
  normalizeEmail,
  staffPasswordStrengthError,
  type StaffRole,
  type StaffUserProfile,
} from "@mccoy/domain";
import {
  AdminAuthError,
  assertStaffAccountChangeRateLimit,
  assertStaffInviteAcceptRateLimit,
  readSupabaseRefreshToken,
  type AdminPrincipal,
} from "@mccoy/security";

import { countWebsiteRequests } from "./json-store";
import { getCmsStore } from "./cms";
import {
  blockStaffUser,
  changeStaffRole,
  countActiveSuperAdmins,
  countRosterSuperAdmins,
  deleteAuthStaffUser,
  deleteAuthTotpFactorsExcept,
  getStaffUserById,
  listActiveStaffUsers,
  revokeActiveStaffInvitationsForEmail,
  updateStaffFullName,
  writeStaffAudit,
  acceptStaffInvitation,
  expireStaffInvitationIfNeeded,
  getStaffInvitationForAuthUser,
  isStaffInvitationAcceptable,
  isStaffMfaRecoveryInvitation,
  isStaffMfaRecoveryProfileEligible,
  activateStaffUser,
} from "./staff";
import {
  assertCanChangeStaffRole,
  MAX_SUPER_ADMINS,
  shouldHardDeleteStaffOnRemove,
} from "./staff-policy";
import {
  countVerifiedTotpFactorsForAccessToken,
  getStaffAccessToken,
  reestablishStaffSessionAfterPasswordSet,
  requireAdminSession,
  signOutAdminSessions,
  type StaffSessionBrowserHydration,
} from "./staff-auth";
import {
  createSupabaseServiceClient,
  getSupabasePublicConfig,
} from "./supabase";

export type StaffSettingsProfile = {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole | null;
  status: StaffUserProfile["status"];
  aal: "aal1" | "aal2" | null;
  mfaActive: boolean;
  mode: AdminPrincipal["mode"];
  updatedAt: string;
};

export type StaffAccountFailure = {
  ok: false;
  error: string;
  code?: "unauthorized" | "rate_limited" | "validation" | "config";
};

export type StaffAccountResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | StaffAccountFailure;

function createUserScopedClient(accessToken: string) {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

function requireSupabaseStaff(session: AdminPrincipal): asserts session is AdminPrincipal & {
  userId: string;
  mode: "supabase";
} {
  if (session.mode !== "supabase" || !session.userId) {
    throw new AdminAuthError(
      "Deze actie is alleen beschikbaar voor Supabase-medewerkersaccounts.",
    );
  }
}

function toErrorResult(error: unknown): StaffAccountFailure {
  if (error instanceof AdminAuthError) {
    const rateLimited = error.message.includes("Te veel");
    return {
      ok: false,
      error: error.message,
      code: rateLimited ? "rate_limited" : "unauthorized",
    };
  }
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Er ging iets mis. Probeer het opnieuw." };
}

export async function getOwnStaffSettingsProfile(): Promise<
  StaffAccountResult<StaffSettingsProfile>
> {
  try {
    const session = await requireAdminSession();
    requireSupabaseStaff(session);

    const profile = await getStaffUserById(session.userId);
    if (!profile || profile.accountKind !== "staff") {
      return { ok: false, error: "Profiel niet gevonden.", code: "unauthorized" };
    }

    return {
      ok: true,
      data: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        staffRole: profile.staffRole,
        status: profile.status,
        aal: session.aal ?? null,
        mfaActive: session.aal === "aal2",
        mode: session.mode,
        updatedAt: profile.updatedAt,
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function updateOwnStaffProfile(input: {
  fullName: string;
}): Promise<StaffAccountResult<StaffSettingsProfile>> {
  try {
    const session = await requireAdminSession();
    requireSupabaseStaff(session);
    assertStaffAccountChangeRateLimit(session.userId);

    const fullName = input.fullName.trim();
    if (fullName.length < 2 || fullName.length > 200) {
      return {
        ok: false,
        error: "Vul een geldige naam in (2–200 tekens).",
        code: "validation",
      };
    }

    const before = await getStaffUserById(session.userId);
    if (!before) {
      return { ok: false, error: "Profiel niet gevonden.", code: "unauthorized" };
    }

    const updated = await updateStaffFullName(session.userId, fullName);

    const access = await getStaffAccessToken();
    if (access) {
      const client = createUserScopedClient(access);
      await client.auth.updateUser({ data: { full_name: fullName } }).catch(() => undefined);
    }

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.profile_changed",
      targetType: "user",
      targetId: session.userId,
      before: { full_name: before.fullName },
      after: { full_name: updated.fullName },
    }).catch(() => undefined);

    return {
      ok: true,
      data: {
        id: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        staffRole: updated.staffRole,
        status: updated.status,
        aal: session.aal ?? null,
        mfaActive: session.aal === "aal2",
        mode: session.mode,
        updatedAt: updated.updatedAt,
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function changeOwnStaffEmail(input: {
  newEmail: string;
}): Promise<StaffAccountResult<{ pendingEmail: string; confirmationRequired: true }>> {
  try {
    const session = await requireAdminSession();
    requireSupabaseStaff(session);
    assertStaffAccountChangeRateLimit(session.userId);

    const pendingEmail = normalizeEmail(input.newEmail);
    if (!pendingEmail.includes("@") || pendingEmail.length > 320) {
      return { ok: false, error: "Vul een geldig e-mailadres in.", code: "validation" };
    }

    const before = await getStaffUserById(session.userId);
    if (!before) {
      return { ok: false, error: "Profiel niet gevonden.", code: "unauthorized" };
    }

    if (normalizeEmail(before.email) === pendingEmail) {
      return { ok: false, error: "Dit is al je huidige e-mailadres.", code: "validation" };
    }

    const access = await getStaffAccessToken();
    if (!access) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    // setSession so GoTrue has a real session (Authorization header alone is not enough).
    const refresh = readSupabaseRefreshToken();
    if (!refresh) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    const client = createUserScopedClient(access);
    const { error: sessionError } = await client.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (sessionError) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    const { error } = await client.auth.updateUser({ email: pendingEmail });
    if (error) {
      return {
        ok: false,
        error:
          error.message?.trim() ||
          "E-mailwijziging mislukt. Controleer het adres of probeer later opnieuw. Bevestiging per e-mail kan vereist zijn.",
      };
    }

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.email_changed",
      targetType: "user",
      targetId: session.userId,
      before: { email: before.email },
      after: { email_pending: pendingEmail, confirmation_required: true },
    }).catch(() => undefined);

    return {
      ok: true,
      data: { pendingEmail, confirmationRequired: true },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

export async function changeOwnStaffPassword(input: {
  currentPassword: string;
  newPassword: string;
  totpCode: string;
}): Promise<StaffAccountResult> {
  try {
    const session = await requireAdminSession();
    requireSupabaseStaff(session);
    assertStaffAccountChangeRateLimit(session.userId);

    if (session.aal !== "aal2") {
      return {
        ok: false,
        error: "Rond eerst MFA af (aal2) voordat je je wachtwoord kunt wijzigen.",
        code: "unauthorized",
      };
    }

    const passwordError = staffPasswordStrengthError(input.newPassword);
    if (passwordError) {
      return {
        ok: false,
        error: passwordError,
        code: "validation",
      };
    }
    if (input.currentPassword === input.newPassword) {
      return {
        ok: false,
        error: "Kies een nieuw wachtwoord dat verschilt van het huidige.",
        code: "validation",
      };
    }

    const totpCode = input.totpCode.trim();
    if (!/^\d{6}$/.test(totpCode)) {
      return {
        ok: false,
        error: "Voer de 6-cijferige MFA-code in.",
        code: "validation",
      };
    }

    const { url, publishableKey } = getSupabasePublicConfig();
    const verifyClient = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: verifyError } = await verifyClient.auth.signInWithPassword({
      email: session.username,
      password: input.currentPassword,
    });
    if (verifyError) {
      return { ok: false, error: "Huidig wachtwoord is onjuist.", code: "validation" };
    }

    const access = await getStaffAccessToken();
    const refresh = readSupabaseRefreshToken();
    if (!access || !refresh) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    const mfaClient = createUserScopedClient(access);
    const { error: sessionError } = await mfaClient.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (sessionError) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    const { data: factors, error: factorsError } = await mfaClient.auth.mfa.listFactors();
    if (factorsError) {
      return {
        ok: false,
        error: "MFA-factoren konden niet worden geladen. Probeer opnieuw.",
      };
    }
    const factor = factors?.totp.find((f) => f.status === "verified");
    if (!factor) {
      return {
        ok: false,
        error: "Geen actieve MFA-factor. Stel eerst 2FA in via /admin/mfa.",
        code: "unauthorized",
      };
    }

    const challenge = await mfaClient.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error || !challenge.data) {
      return {
        ok: false,
        error: "MFA-challenge mislukt. Probeer het opnieuw.",
      };
    }

    const verified = await mfaClient.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: totpCode,
    });
    if (verified.error) {
      return {
        ok: false,
        error: "Ongeldige MFA-code. Probeer het opnieuw.",
        code: "validation",
      };
    }

    // Prefer Auth Admin after current password + MFA are verified.
    const service = createSupabaseServiceClient();
    const { error } = await service.auth.admin.updateUserById(session.userId, {
      password: input.newPassword,
    });
    if (error) {
      const hint = error.message?.trim();
      return {
        ok: false,
        error: hint
          ? `Wachtwoord kon niet worden bijgewerkt: ${hint}`
          : "Wachtwoord kon niet worden bijgewerkt. Probeer het opnieuw.",
      };
    }

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.password_changed",
      targetType: "user",
      targetId: session.userId,
      after: { changed: true, mfa_confirmed: true },
    }).catch(() => undefined);

    return { ok: true };
  } catch (error) {
    return toErrorResult(error);
  }
}

export type StaffPasswordRecoveryContext = {
  email: string;
  fullName: string | null;
  /** When true, user must enter TOTP before password can be saved. */
  requiresMfaCode: boolean;
};

export type StaffPasswordRecoveryNextStep = "login" | "mfa_enroll";

export type StaffPasswordRecoveryCompleteData = {
  nextStep: StaffPasswordRecoveryNextStep;
  browserHydration?: StaffSessionBrowserHydration;
};

export type StaffMfaRecoveryContext = {
  email: string;
  fullName: string | null;
};

/**
 * Context for super-admin MFA account recovery on /admin/recover-mfa.
 * Password is not changed; user re-enrolls TOTP only.
 */
export async function getStaffMfaRecoveryContext(): Promise<
  StaffAccountResult<StaffMfaRecoveryContext>
> {
  try {
    const session = await requireAdminSession({ allowMfaEnrollment: true });
    requireSupabaseStaff(session);

    const profile = await getStaffUserById(session.userId);
    if (!profile || profile.accountKind !== "staff") {
      return { ok: false, error: "Geen geldig beheerdersaccount.", code: "unauthorized" };
    }
    if (profile.blockedAt || profile.status === "blocked") {
      return { ok: false, error: "Dit account is geblokkeerd.", code: "unauthorized" };
    }
    let invitation = await getStaffInvitationForAuthUser(session.userId);
    if (!invitation || !isStaffMfaRecoveryInvitation(invitation)) {
      return {
        ok: false,
        error: "Geen geldige authenticator-herstelsessie. Open de link uit je herstel-e-mail opnieuw.",
        code: "unauthorized",
      };
    }

    if (!isStaffMfaRecoveryProfileEligible(profile, invitation)) {
      return {
        ok: false,
        error: "Deze herstellink is niet meer geldig. Vraag een super admin om opnieuw herstel.",
        code: "unauthorized",
      };
    }

    invitation = await expireStaffInvitationIfNeeded(invitation);
    const acceptable = isStaffInvitationAcceptable(invitation);
    if (!acceptable.ok) {
      const messages: Record<string, string> = {
        expired: "Deze herstellink is verlopen. Vraag een super admin om opnieuw herstel.",
        revoked: "Deze herstellink is ingetrokken.",
        failed: "Deze herstellink is ongeldig.",
        already_accepted: "Herstel is al afgerond. Log in met je wachtwoord en nieuwe authenticatorcode.",
        invalid_status: "Deze herstellink is niet meer geldig.",
      };
      return {
        ok: false,
        error: messages[acceptable.reason] ?? messages.invalid_status,
        code: "unauthorized",
      };
    }

    return {
      ok: true,
      data: {
        email: profile.email,
        fullName: profile.fullName,
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Finalize MFA account recovery after the user enrolled a new TOTP factor.
 * Accepts the recovery invitation, reactivates the account, audits, and ends the session.
 */
export async function completeStaffMfaRecovery(): Promise<
  StaffAccountResult<{ redirect: "login" }>
> {
  try {
    const session = await requireAdminSession({ allowMfaEnrollment: true });
    requireSupabaseStaff(session);
    assertStaffInviteAcceptRateLimit(session.userId);

    const access = await getStaffAccessToken();
    if (!access) {
      throw new AdminAuthError("Sessie verlopen. Open de herstellink opnieuw.");
    }

    const verifiedFactorCount = await countVerifiedTotpFactorsForAccessToken(access);
    if (verifiedFactorCount <= 0) {
      return {
        ok: false,
        error: "Stel eerst je nieuwe authenticator in voordat je doorgaat.",
        code: "validation",
      };
    }

    const profile = await getStaffUserById(session.userId);
    if (!profile || profile.accountKind !== "staff") {
      return { ok: false, error: "Geen geldige herstelsessie.", code: "unauthorized" };
    }

    let invitation = await getStaffInvitationForAuthUser(session.userId);
    if (!invitation || !isStaffMfaRecoveryInvitation(invitation)) {
      return { ok: false, error: "Geen geldige authenticator-herstelsessie.", code: "unauthorized" };
    }

    if (!isStaffMfaRecoveryProfileEligible(profile, invitation)) {
      return { ok: false, error: "Geen geldige herstelsessie.", code: "unauthorized" };
    }

    const priorStatus = profile.status;

    invitation = await expireStaffInvitationIfNeeded(invitation);
    const acceptable = isStaffInvitationAcceptable(invitation);
    if (!acceptable.ok && invitation.status !== "accepted") {
      return { ok: false, error: "Deze herstellink is niet meer geldig.", code: "unauthorized" };
    }

    if (invitation.status !== "accepted") {
      await acceptStaffInvitation({
        invitationId: invitation.id,
        authUserId: session.userId,
      });
    }

    await activateStaffUser(session.userId);

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.mfa_onboarding_completed",
      targetType: "user",
      targetId: session.userId,
      before: { status: priorStatus },
      after: { status: "active", source: "mfa_recovery" },
    }).catch(() => undefined);

    await createSupabaseServiceClient()
      .auth.admin.signOut(session.userId, "global")
      .catch(() => undefined);
    signOutAdminSessions();

    return { ok: true, data: { redirect: "login" } };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Pure gate: when verified TOTP factors exist, recovery must include a 6-digit code.
 * Returns a Dutch error message or null when input is acceptable.
 */
export function assertStaffPasswordRecoveryTotpInput(
  verifiedFactorCount: number,
  totpCode: string | undefined,
): string | null {
  if (verifiedFactorCount <= 0) return null;
  const trimmed = (totpCode ?? "").trim();
  if (!/^\d{6}$/.test(trimmed)) {
    return "Voer de 6-cijferige MFA-code in.";
  }
  return null;
}

/**
 * Context for active staff completing a recovery link on /admin/invite.
 */
export async function getStaffPasswordRecoveryContext(): Promise<
  StaffAccountResult<StaffPasswordRecoveryContext>
> {
  try {
    const session = await requireAdminSession({ allowMfaEnrollment: true });
    requireSupabaseStaff(session);

    const profile = await getStaffUserById(session.userId);
    if (!profile || profile.accountKind !== "staff") {
      return { ok: false, error: "Geen geldig beheerdersaccount.", code: "unauthorized" };
    }
    if (profile.blockedAt || profile.status === "blocked") {
      return { ok: false, error: "Dit account is geblokkeerd.", code: "unauthorized" };
    }
    if (profile.status === "invited") {
      return {
        ok: false,
        error: "Gebruik je uitnodigingslink om je account af te ronden.",
        code: "unauthorized",
      };
    }

    const access = await getStaffAccessToken();
    const verifiedFactorCount = access ? await countVerifiedTotpFactorsForAccessToken(access) : 0;

    return {
      ok: true,
      data: {
        email: profile.email,
        fullName: profile.fullName,
        requiresMfaCode: verifiedFactorCount > 0,
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Complete password recovery after the user opened a reset e-mail link.
 * When MFA is enrolled, TOTP must be verified server-side before the password is changed.
 * When no MFA exists yet, password is set and caller should redirect to MFA enrollment.
 */
export async function completeStaffPasswordRecovery(input: {
  newPassword: string;
  totpCode?: string;
}): Promise<StaffAccountResult<StaffPasswordRecoveryCompleteData>> {
  try {
    const session = await requireAdminSession({ allowMfaEnrollment: true });
    requireSupabaseStaff(session);
    assertStaffInviteAcceptRateLimit(session.userId);

    const profile = await getStaffUserById(session.userId);
    if (!profile || profile.accountKind !== "staff" || profile.status !== "active") {
      return { ok: false, error: "Geen geldige reset-sessie.", code: "unauthorized" };
    }

    const passwordError = staffPasswordStrengthError(input.newPassword);
    if (passwordError) {
      return { ok: false, error: passwordError, code: "validation" };
    }

    const access = await getStaffAccessToken();
    const refresh = readSupabaseRefreshToken();
    if (!access || !refresh) {
      throw new AdminAuthError("Sessie verlopen. Open de resetlink opnieuw.");
    }

    const mfaClient = createUserScopedClient(access);
    const { error: sessionError } = await mfaClient.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (sessionError) {
      throw new AdminAuthError("Sessie verlopen. Open de resetlink opnieuw.");
    }

    const { data: factors, error: factorsError } = await mfaClient.auth.mfa.listFactors();
    if (factorsError) {
      return {
        ok: false,
        error: "MFA-factoren konden niet worden geladen. Probeer opnieuw.",
      };
    }

    const verifiedFactors = (factors?.totp ?? []).filter((f) => f.status === "verified");
    const totpInputError = assertStaffPasswordRecoveryTotpInput(
      verifiedFactors.length,
      input.totpCode,
    );
    if (totpInputError) {
      return { ok: false, error: totpInputError, code: "validation" };
    }

    if (verifiedFactors.length > 0) {
      const factor = verifiedFactors[0]!;
      const challenge = await mfaClient.auth.mfa.challenge({ factorId: factor.id });
      if (challenge.error || !challenge.data) {
        return {
          ok: false,
          error: "MFA-challenge mislukt. Probeer het opnieuw.",
        };
      }

      const verified = await mfaClient.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.data.id,
        code: input.totpCode!.trim(),
      });
      if (verified.error) {
        return {
          ok: false,
          error: "Ongeldige MFA-code. Probeer het opnieuw.",
          code: "validation",
        };
      }
    }

    const service = createSupabaseServiceClient();
    const { error: updateError } = await service.auth.admin.updateUserById(session.userId, {
      password: input.newPassword,
    });
    if (updateError) {
      const hint = updateError.message?.trim();
      return {
        ok: false,
        error: hint
          ? `Wachtwoord kon niet worden bijgewerkt: ${hint}`
          : "Wachtwoord kon niet worden bijgewerkt. Probeer het opnieuw.",
      };
    }

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.password_changed",
      targetType: "user",
      targetId: session.userId,
      after: {
        source: "recovery_email_completed",
        mfa_confirmed: verifiedFactors.length > 0,
      },
    }).catch(() => undefined);

    if (verifiedFactors.length > 0) {
      return {
        ok: true,
        data: {
          nextStep: "login",
        },
      };
    }

    const sessionRefresh = await reestablishStaffSessionAfterPasswordSet({
      email: profile.email,
      password: input.newPassword,
      clientKey: session.userId,
    });
    if (!sessionRefresh.ok) {
      return { ok: false, error: sessionRefresh.error };
    }

    return {
      ok: true,
      data: {
        nextStep: "mfa_enroll",
        browserHydration: sessionRefresh.browserHydration,
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Self-service authenticator replacement for staff at AAL2.
 * Caller enrolls + verifies a new TOTP factor client-side, then passes its id here.
 * Old verified factors are removed only after the new factor is confirmed verified.
 */
export async function finalizeStaffAuthenticatorReplace(input: {
  keepFactorId: string;
}): Promise<StaffAccountResult<{ factorsRemoved: number }>> {
  try {
    const session = await requireAdminSession();
    requireSupabaseStaff(session);
    assertStaffAccountChangeRateLimit(session.userId);

    if (session.aal !== "aal2") {
      return {
        ok: false,
        error:
          "Rond eerst MFA af (aal2) voordat je je authenticator kunt vervangen. Ben je je authenticator kwijt? Vraag herstel aan een super admin.",
        code: "unauthorized",
      };
    }

    const keepFactorId = input.keepFactorId.trim();
    if (!keepFactorId) {
      return {
        ok: false,
        error: "Geen geldige MFA-factor opgegeven.",
        code: "validation",
      };
    }

    const access = await getStaffAccessToken();
    const refresh = readSupabaseRefreshToken();
    if (!access || !refresh) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    const mfaClient = createUserScopedClient(access);
    const { error: sessionError } = await mfaClient.auth.setSession({
      access_token: access,
      refresh_token: refresh,
    });
    if (sessionError) {
      throw new AdminAuthError("Sessie verlopen. Log opnieuw in.");
    }

    const { data: factors, error: factorsError } = await mfaClient.auth.mfa.listFactors();
    if (factorsError) {
      return {
        ok: false,
        error: "MFA-factoren konden niet worden geladen. Probeer opnieuw.",
      };
    }

    const kept = (factors?.totp ?? []).find(
      (factor) => factor.id === keepFactorId && factor.status === "verified",
    );
    if (!kept) {
      return {
        ok: false,
        error:
          "Nieuwe authenticator is nog niet geverifieerd. Scan de QR-code en voer de code in.",
        code: "validation",
      };
    }

    const verifiedOthers = (factors?.totp ?? []).filter(
      (factor) => factor.status === "verified" && factor.id !== keepFactorId,
    );
    const removed = await deleteAuthTotpFactorsExcept(session.userId, keepFactorId);
    if (verifiedOthers.length > 0 && removed <= 0) {
      return {
        ok: false,
        error:
          "Oude authenticator kon niet worden verwijderd. Probeer opnieuw of vraag herstel aan een super admin.",
      };
    }

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.mfa_reset",
      targetType: "user",
      targetId: session.userId,
      after: {
        source: "self_service_replace",
        keep_factor_id: keepFactorId,
        factors_removed: removed,
      },
    }).catch(() => undefined);

    return {
      ok: true,
      data: { factorsRemoved: removed },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

export type SuperAdminSettingsOverview = {
  staffUsers: StaffUserProfile[];
  /** Active + invited super_admins (cap = 2). */
  rosterSuperAdminCount: number;
  maxSuperAdmins: number;
  cmsPageCount: number;
  websiteRequestCount: number;
  links: Array<{
    to: "/website" | "/inquiries" | "/users";
    label: string;
    hint: string;
  }>;
};

export async function getSuperAdminSettingsOverview(): Promise<
  StaffAccountResult<SuperAdminSettingsOverview>
> {
  try {
    const session = await requireAdminSession();
    if (session.staffRole !== "super_admin") {
      return {
        ok: false,
        error: "Alleen een super_admin mag dit overzicht zien.",
        code: "unauthorized",
      };
    }

    const [staffUsers, rosterSuperAdminCount] = await Promise.all([
      listActiveStaffUsers(),
      countRosterSuperAdmins(),
    ]);

    let cmsPageCount = 0;
    try {
      const pages = await getCmsStore().listPages();
      cmsPageCount = pages.length;
    } catch {
      cmsPageCount = 0;
    }

    let websiteRequestCount = 0;
    try {
      websiteRequestCount = await countWebsiteRequests();
    } catch {
      websiteRequestCount = 0;
    }

    return {
      ok: true,
      data: {
        staffUsers,
        rosterSuperAdminCount,
        maxSuperAdmins: MAX_SUPER_ADMINS,
        cmsPageCount,
        websiteRequestCount,
        links: [
          { to: "/website", label: "Website / CMS", hint: "Pagina's en content" },
          { to: "/inquiries", label: "Aanvragen", hint: "Inkomende berichten" },
          { to: "/users", label: "Gebruikers", hint: "Teamoverzicht" },
        ],
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Promote or demote staff (admin ↔ super_admin). Profile/data stay intact.
 * Only an active super_admin may call this; the last super_admin cannot be demoted.
 */
export async function changeStaffMemberRole(input: {
  targetUserId: string;
  staffRole: "admin" | "super_admin";
}): Promise<StaffAccountResult<{ userId: string; staffRole: "admin" | "super_admin" }>> {
  try {
    const session = await requireAdminSession();
    const actor = session.userId ? await getStaffUserById(session.userId) : null;
    const target = await getStaffUserById(input.targetUserId);
    const [activeSuperAdminCount, rosterSuperAdminCount] = await Promise.all([
      countActiveSuperAdmins(),
      countRosterSuperAdmins(),
    ]);

    assertCanChangeStaffRole({
      actorUserId: session.userId,
      actor,
      target,
      nextRole: input.staffRole,
      rosterSuperAdminCount,
      activeSuperAdminCount,
    });

    if (!session.userId || !target) {
      return { ok: false, error: "Medewerker niet gevonden.", code: "validation" };
    }

    assertStaffAccountChangeRateLimit(session.userId);

    const updated = await changeStaffRole({
      userId: target.id,
      staffRole: input.staffRole,
    });

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.role_changed",
      targetType: "user",
      targetId: target.id,
      before: { staff_role: target.staffRole },
      after: { staff_role: updated.staffRole },
    }).catch(() => undefined);

    return {
      ok: true,
      data: { userId: updated.id, staffRole: updated.staffRole as "admin" | "super_admin" },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Remove an internal staff user from the active roster.
 * Invited (never active) staff: hard-delete Auth user so the same email can be
 * re-invited cleanly. Active staff: soft-block + Auth ban (audit retained).
 */
export async function removeStaffMemberFromRoster(input: {
  targetUserId: string;
}): Promise<StaffAccountResult<{ removedUserId: string }>> {
  try {
    const session = await requireAdminSession();
    if (session.staffRole !== "super_admin" || !session.userId) {
      return {
        ok: false,
        error: "Alleen een super_admin mag medewerkers verwijderen.",
        code: "unauthorized",
      };
    }
    assertStaffAccountChangeRateLimit(session.userId);

    if (input.targetUserId === session.userId) {
      return {
        ok: false,
        error: "Je kunt jezelf niet verwijderen.",
        code: "validation",
      };
    }

    const target = await getStaffUserById(input.targetUserId);
    if (!target || target.accountKind !== "staff") {
      return { ok: false, error: "Medewerker niet gevonden.", code: "validation" };
    }
    if (target.status === "blocked" || target.blockedAt) {
      return { ok: false, error: "Deze medewerker is al verwijderd.", code: "validation" };
    }

    if (target.staffRole === "super_admin") {
      const activeSupers = await countActiveSuperAdmins();
      if (activeSupers <= 1) {
        return {
          ok: false,
          error: "Je kunt de laatste actieve super_admin niet verwijderen.",
          code: "validation",
        };
      }
    }

    const before = {
      email: target.email,
      status: target.status,
      staff_role: target.staffRole,
    };

    await revokeActiveStaffInvitationsForEmail(target.email);

    const service = createSupabaseServiceClient();

    if (shouldHardDeleteStaffOnRemove(target)) {
      await service.auth.admin.signOut(target.id, "global").catch(() => undefined);
      try {
        await deleteAuthStaffUser(target.id);
        await writeStaffAudit({
          actorUserId: session.userId,
          action: "staff.blocked",
          targetType: "user",
          targetId: target.id,
          before,
          after: {
            removed_from_roster: true,
            hard_deleted_auth: true,
            prior_status: target.status,
          },
        }).catch(() => undefined);
        return { ok: true, data: { removedUserId: target.id } };
      } catch (deleteError) {
        const message =
          deleteError instanceof Error ? deleteError.message : String(deleteError);
        console.warn("removeStaffMemberFromRoster hard delete failed, soft-blocking:", message);
      }
    }

    const blocked = await blockStaffUser(target.id);

    const { error: banError } = await service.auth.admin.updateUserById(target.id, {
      ban_duration: "876000h", // ~100 years
    });
    if (banError) {
      console.warn("removeStaffMemberFromRoster ban failed:", banError.message);
    }
    await service.auth.admin.signOut(target.id, "global").catch(() => undefined);

    await writeStaffAudit({
      actorUserId: session.userId,
      action: "staff.blocked",
      targetType: "user",
      targetId: target.id,
      before,
      after: {
        status: blocked.status,
        blocked_at: blocked.blockedAt,
        removed_from_roster: true,
        hard_deleted_auth: false,
      },
    }).catch(() => undefined);

    return { ok: true, data: { removedUserId: target.id } };
  } catch (error) {
    return toErrorResult(error);
  }
}
