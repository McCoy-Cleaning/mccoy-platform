import { createServerFn } from "@tanstack/react-start";

import {
  completeStaffMfaOnboarding,
  establishLegacyAdminSession,
  establishStaffSessionFromTokens,
  establishStaffSessionWithPassword,
  isStaffSupabaseAuthEnabled,
  readAdminSession,
  signOutAdminSessions,
} from "@mccoy/database/server";
import { getSupabaseAdminEnvDiagnostics } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  adminEmailLoginSchema,
  adminEstablishSessionSchema,
  adminLoginSchema,
} from "@mccoy/validation";

export const getAdminAuthMode = createServerFn({ method: "POST" }).handler(async () => {
  ensureMonorepoEnvLoaded();
  if (process.env.MCCOY_E2E === "1") {
    return {
      supabaseEnabled: false,
      legacyEnabled: true,
      hasUrl: false,
      hasPublishable: false,
      hasSecret: false,
    };
  }
  const diagnostics = getSupabaseAdminEnvDiagnostics();
  return {
    supabaseEnabled: isStaffSupabaseAuthEnabled() && diagnostics.supabaseEnabled,
    legacyEnabled: diagnostics.legacyEnabled,
    // Booleans only — never secret values.
    hasUrl: diagnostics.hasUrl,
    hasPublishable: diagnostics.hasPublishable,
    hasSecret: diagnostics.hasSecret,
  };
});

export const adminEstablishSession = createServerFn({ method: "POST" })
  .validator(adminEstablishSessionSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      return await establishStaffSessionFromTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        clientKey: data.clientKey,
      });
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Inloggen mislukt.",
        code: "unknown" as const,
      };
    }
  });

export const adminSignInWithEmail = createServerFn({ method: "POST" })
  .validator(adminEmailLoginSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      return await establishStaffSessionWithPassword({
        email: data.email,
        password: data.password,
        clientKey: data.clientKey ?? data.email,
      });
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Inloggen mislukt.",
        code: "unknown" as const,
      };
    }
  });

export const adminSignIn = createServerFn({ method: "POST" })
  .validator(adminLoginSchema)
  .handler(async ({ data }) => {
    return establishLegacyAdminSession({
      username: data.username,
      password: data.password,
    });
  });

export const adminCompleteMfa = createServerFn({ method: "POST" }).handler(async () => {
  return completeStaffMfaOnboarding();
});

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => {
  signOutAdminSessions();
  return { ok: true as const };
});

export const getAdminSession = createServerFn({ method: "POST" }).handler(async () => {
  const session = await readAdminSession({ allowMfaEnrollment: true });
  return { session };
});
