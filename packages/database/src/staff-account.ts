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
  readSupabaseRefreshToken,
  type AdminPrincipal,
} from "@mccoy/security";

import { countWebsiteRequests } from "./json-store";
import { getCmsStore } from "./cms";
import {
  blockStaffUser,
  countActiveSuperAdmins,
  getStaffUserById,
  listActiveStaffUsers,
  revokeActiveStaffInvitationsForEmail,
  updateStaffFullName,
  writeStaffAudit,
} from "./staff";
import { getStaffAccessToken, requireAdminSession } from "./staff-auth";
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

export type SuperAdminSettingsOverview = {
  staffUsers: StaffUserProfile[];
  cmsPageCount: number;
  websiteRequestCount: number;
  links: Array<{
    to: "/admin/website" | "/admin/inquiries" | "/admin/users";
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

    const staffUsers = await listActiveStaffUsers();

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
        cmsPageCount,
        websiteRequestCount,
        links: [
          { to: "/admin/website", label: "Website / CMS", hint: "Pagina's en content" },
          { to: "/admin/inquiries", label: "Aanvragen", hint: "Inkomende berichten" },
          { to: "/admin/users", label: "Gebruikers", hint: "Teamoverzicht" },
        ],
      },
    };
  } catch (error) {
    return toErrorResult(error);
  }
}

/**
 * Soft-remove an internal staff user from the active roster.
 * Blocks the profile, bans Auth login, revokes open invites.
 * Does not hard-delete (audit history retained).
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

    const blocked = await blockStaffUser(target.id);
    await revokeActiveStaffInvitationsForEmail(target.email);

    const service = createSupabaseServiceClient();
    // Ban sign-in; keep Auth user for reconciliation / audit linkage.
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
      },
    }).catch(() => undefined);

    return { ok: true, data: { removedUserId: target.id } };
  } catch (error) {
    return toErrorResult(error);
  }
}
