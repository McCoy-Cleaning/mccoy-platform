import { createServerFn } from "@tanstack/react-start";
import { AdminAuthError } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import { adminPortalUsersDirectorySchema, portalUserDetailKeySchema } from "@mccoy/validation";
import {
  customerRequestPasswordReset,
  getPortalUserDetail,
  listAdminPortalUsersDirectory,
  requireAdminSession,
} from "@mccoy/database/server";

/** Only authorization copy reaches the browser; raw DB/provider text is logged server-side. */
function authErrorResult(error: unknown): { ok: false; error: string } {
  if (error instanceof AdminAuthError) {
    return { ok: false, error: error.message };
  }
  console.error("[admin-users] unexpected server function error", error);
  return { ok: false, error: "Er ging iets mis. Probeer het opnieuw." };
}

export const listAdminPortalUsers = createServerFn({ method: "POST" })
  .validator(adminPortalUsersDirectorySchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const result = await listAdminPortalUsersDirectory(
        {
          q: data.q,
          companyId: data.companyId,
          userId: data.userId,
          page: data.page,
          pageSize: data.pageSize,
        },
        "staff",
      );
      return { ok: true as const, ...result };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const getAdminPortalUserDetail = createServerFn({ method: "POST" })
  .validator(portalUserDetailKeySchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      await requireAdminSession();
      const result = await getPortalUserDetail(data.userId, { kind: "staff" });
      if (!result.ok) {
        return {
          ok: false as const,
          error:
            result.error === "forbidden"
              ? "Niet geautoriseerd."
              : "Gebruiker niet gevonden.",
        };
      }
      return { ok: true as const, detail: result.detail };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const requestAdminPortalUserPasswordReset = createServerFn({ method: "POST" })
  .validator(portalUserDetailKeySchema)
  .handler(async ({ data }) => {
    try {
      ensureMonorepoEnvLoaded();
      const session = await requireAdminSession();
      const result = await getPortalUserDetail(data.userId, { kind: "staff" });
      if (!result.ok || !result.detail.email) {
        return { ok: false as const, error: "Gebruiker niet gevonden." };
      }
      await customerRequestPasswordReset({
        email: result.detail.email,
        clientKey: `staff:${session.userId ?? "admin"}:${result.detail.email}`,
      });
      return { ok: true as const };
    } catch (error) {
      return authErrorResult(error);
    }
  });
