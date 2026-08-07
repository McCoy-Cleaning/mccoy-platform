import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

import {
  completeMfaBrowserFlow,
  completeStaffMfaOnboarding,
  ensureMfaBrowserSession,
  establishLegacyAdminSession,
  establishStaffSessionFromEmailAuthCallback,
  establishStaffSessionFromTokens,
  establishStaffSessionWithPassword,
  hydrateRealtimeAccessToken,
  isStaffSupabaseAuthEnabled,
  readAdminSession,
  signOutAdminSessions,
  startMfaBrowserFlow,
} from "@mccoy/database/server";
import { getSupabaseAdminEnvDiagnostics } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  adminAuthCallbackExchangeSchema,
  adminEmailLoginSchema,
  adminEnsureMfaBrowserSessionSchema,
  adminEstablishSessionSchema,
  adminLoginSchema,
  adminStartMfaBrowserFlowSchema,
} from "@mccoy/validation";

function setNoStoreHeaders(): void {
  setResponseHeader("Cache-Control", "no-store");
  setResponseHeader("Pragma", "no-cache");
}

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
      setNoStoreHeaders();
      return await establishStaffSessionFromTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        clientKey: data.clientKey,
        requireAal2: data.requireAal2 === true,
      });
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Inloggen mislukt.",
        code: "unknown" as const,
      };
    }
  });

/** Verify invite/recovery link server-side → HttpOnly cookies (+ optional one-shot hydration unused by UI). */
export const adminExchangeAuthCallback = createServerFn({ method: "POST" })
  .validator(adminAuthCallbackExchangeSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      setNoStoreHeaders();
      return await establishStaffSessionFromEmailAuthCallback({
        tokenHash: data.tokenHash,
        type: data.type,
        code: data.code,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        clientKey: data.clientKey,
      });
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Uitnodigingssessie mislukt.",
        code: "unknown" as const,
      };
    }
  });

/** Access-token-only Realtime hydrate — never returns refreshToken. */
export const adminHydrateRealtimeAccessToken = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      ensureMonorepoEnvLoaded();
      setNoStoreHeaders();
      return await hydrateRealtimeAccessToken();
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Realtime-token kon niet worden geladen.",
        code: "unknown" as const,
      };
    }
  },
);

export const adminStartMfaBrowserFlow = createServerFn({ method: "POST" })
  .validator(adminStartMfaBrowserFlowSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      setNoStoreHeaders();
      return await startMfaBrowserFlow({ purpose: data.purpose });
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "MFA-flow starten mislukt.",
        code: "unknown" as const,
      };
    }
  });

export const adminEnsureMfaBrowserSession = createServerFn({ method: "POST" })
  .validator(adminEnsureMfaBrowserSessionSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      setNoStoreHeaders();
      return await ensureMfaBrowserSession({ purpose: data.purpose });
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "MFA-sessie kon niet worden geladen.",
        code: "unknown" as const,
      };
    }
  });

export const adminCompleteMfaBrowserFlow = createServerFn({ method: "POST" }).handler(async () => {
  ensureMonorepoEnvLoaded();
  setNoStoreHeaders();
  completeMfaBrowserFlow();
  return { ok: true as const };
});

/**
 * @deprecated Prefer adminStartMfaBrowserFlow + adminEnsureMfaBrowserSession.
 * Kept briefly for residual invite edges; does not purpose-gate refresh handoff.
 */
export const adminHydrateBrowserAuthFromCookies = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      ensureMonorepoEnvLoaded();
      setNoStoreHeaders();
      // Hardened: refuse broad dual-token hydrate — force MFA flow capability path.
      return {
        ok: false as const,
        error: "Gebruik de MFA-flow (start + ensure) in plaats van cookie-hydrate.",
        code: "unknown" as const,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Sessie kon niet worden hersteld.",
        code: "unknown" as const,
      };
    }
  },
);

export const adminSignInWithEmail = createServerFn({ method: "POST" })
  .validator(adminEmailLoginSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      setNoStoreHeaders();
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
