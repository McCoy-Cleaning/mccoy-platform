import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CUSTOMER_ACTIVATION_RATE, assertAdminSameOriginMutation } from "@mccoy/security";
import { assertRateLimit, RateLimitError } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  activateCustomerAccount,
  customerRequestPasswordReset,
  customerCompletePasswordReset,
  customerSignInWithPassword,
  customerSignOut,
  peekInvitationByRawToken,
  readCustomerSession,
  requireAccountAdmin,
  requireCustomerSession,
  accountAdminInviteUser,
  listCompanyMemberships,
  listPendingInvitationsForCompany,
  suspendCompanyMembership,
  reactivateCompanyMembership,
  CustomerPortalError,
} from "@mccoy/database/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  clientKey: z.string().min(1).max(200),
});

const activateSchema = z.object({
  token: z.string().min(16).max(500),
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  phone: z.string().max(40).optional().nullable(),
  password: z.string().min(12).max(200),
  clientKey: z.string().min(1).max(200),
});

const forgotSchema = z.object({
  email: z.string().email(),
  clientKey: z.string().min(1).max(200),
});

const resetPasswordSchema = z.object({
  password: z.string().min(12).max(200),
  clientKey: z.string().min(1).max(200),
  accessToken: z.string().min(20).max(32000).optional(),
  refreshToken: z.string().min(10).max(32000).optional(),
  tokenHash: z.string().min(10).max(2048).optional(),
  code: z.string().min(10).max(2048).optional(),
});

const inviteUserSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().nullable(),
});

const membershipActionSchema = z.object({
  userId: z.string().uuid(),
});

function portalError(error: unknown): { ok: false; error: string; code?: string } {
  if (error instanceof CustomerPortalError) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Er ging iets mis. Probeer het opnieuw." };
}

export const getAccountSession = createServerFn({ method: "POST" }).handler(async () => {
  ensureMonorepoEnvLoaded();
  const session = await readCustomerSession();
  return { ok: true as const, session };
});

export const accountLogin = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      assertAdminSameOriginMutation();
      const result = await customerSignInWithPassword(data);
      return result;
    } catch (error) {
      return portalError(error);
    }
  });

export const accountLogout = createServerFn({ method: "POST" }).handler(async () => {
  ensureMonorepoEnvLoaded();
  assertAdminSameOriginMutation();
  await customerSignOut();
  return { ok: true as const };
});

export const accountForgotPassword = createServerFn({ method: "POST" })
  .validator(forgotSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await customerRequestPasswordReset(data);
      return {
        ok: true as const,
        message:
          "Als er een account voor dit e-mailadres bestaat, ontvangt u een e-mail met instructies.",
      };
    } catch {
      return {
        ok: true as const,
        message:
          "Als er een account voor dit e-mailadres bestaat, ontvangt u een e-mail met instructies.",
      };
    }
  });

export const accountPeekActivation = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(16).max(500) }))
  .handler(async ({ data }) => {
    ensureMonorepoEnvLoaded();
    const peek = await peekInvitationByRawToken(data.token);
    if (!peek.ok) {
      return { ok: false as const, code: peek.code };
    }
    return { ok: true as const, email: peek.email, companyName: peek.companyName };
  });

export const accountActivate = createServerFn({ method: "POST" })
  .validator(activateSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      assertAdminSameOriginMutation();
      try {
        assertRateLimit(
          `${CUSTOMER_ACTIVATION_RATE.keyPrefix}:${data.clientKey}`,
          CUSTOMER_ACTIVATION_RATE.maxAttempts,
          CUSTOMER_ACTIVATION_RATE.windowMs,
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          return { ok: false as const, error: "Te veel pogingen. Probeer het later opnieuw." };
        }
        throw error;
      }

      const result = await activateCustomerAccount({
        rawToken: data.token,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });
      return { ok: true as const, userId: result.userId, companyId: result.companyId };
    } catch (error) {
      return portalError(error);
    }
  });

export const accountCompletePasswordReset = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      assertAdminSameOriginMutation();
      const result = await customerCompletePasswordReset(data);
      return result;
    } catch (error) {
      return portalError(error);
    }
  });

export const getAccountCompanyUsers = createServerFn({ method: "POST" }).handler(async () => {
  try {
    ensureMonorepoEnvLoaded();
    const session = await requireAccountAdmin();
    const members = await listCompanyMemberships(session.membership.companyId);
    const pending = await listPendingInvitationsForCompany(session.membership.companyId);
    return { ok: true as const, members, pending: pending.map((p) => ({
      email: p.email,
      intendedRole: p.intendedRole,
      expiresAt: p.expiresAt,
    })) };
  } catch (error) {
    return portalError(error);
  }
});

export const accountInviteUser = createServerFn({ method: "POST" })
  .validator(inviteUserSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      assertAdminSameOriginMutation();
      const session = await requireAccountAdmin();
      const result = await accountAdminInviteUser({
        companyId: session.membership.companyId,
        email: data.email,
        actorUserId: session.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return portalError(error);
    }
  });

export const accountSuspendUser = createServerFn({ method: "POST" })
  .validator(membershipActionSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      assertAdminSameOriginMutation();
      const session = await requireAccountAdmin();
      await suspendCompanyMembership({
        companyId: session.membership.companyId,
        userId: data.userId,
        actorUserId: session.userId,
      });
      return { ok: true as const };
    } catch (error) {
      return portalError(error);
    }
  });

export const accountReactivateUser = createServerFn({ method: "POST" })
  .validator(membershipActionSchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      assertAdminSameOriginMutation();
      const session = await requireAccountAdmin();
      await reactivateCompanyMembership({
        companyId: session.membership.companyId,
        userId: data.userId,
        actorUserId: session.userId,
      });
      return { ok: true as const };
    } catch (error) {
      return portalError(error);
    }
  });

export const getAccountDashboard = createServerFn({ method: "POST" }).handler(async () => {
  try {
    ensureMonorepoEnvLoaded();
    const session = await requireCustomerSession();
    return { ok: true as const, session };
  } catch (error) {
    return portalError(error);
  }
});
