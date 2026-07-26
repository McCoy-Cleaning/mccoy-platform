/** Re-export — prefer `@mccoy/database/server` for staff-aware requireAdminSession. */
export {
  type AdminPrincipal,
  getAdminCredentials,
  issueAdminSessionCookie,
  clearAdminSessionCookie,
  readAdminSessionFromCookie,
  assertReplyRateLimit,
  AdminAuthError,
} from "@mccoy/security";

export { requireAdminSession } from "@mccoy/database/server";
