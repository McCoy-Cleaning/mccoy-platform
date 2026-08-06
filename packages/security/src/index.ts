export {
  findMonorepoRoot,
  readServerEnv,
  getDataDir,
} from "./env";

export {
  getHostConfig,
  resolveHostSurface,
  shouldRedirectForHost,
  type HostSurface,
} from "./host";

export {
  isStorefrontIndexable,
  storefrontRobotsMetaContent,
  storefrontRobotsTxt,
  readIndexingEnv,
  type IndexingEnv,
} from "./indexing";

export {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  type SecurityHeaderApp,
  type SecurityHeaderOptions,
} from "./headers";

export {
  assertRateLimit,
  isHoneypotTriggered,
  RateLimitError,
} from "./rate-limit";

export {
  type AdminPrincipal,
  type AdminAuthMode,
  getAdminCredentials,
  isLegacyAdminAuthEnabled,
  hasSupabaseAdminEnvHints,
  getSupabaseAdminEnvDiagnostics,
  preferSupabaseAdminAuth,
  issueAdminSessionCookie,
  clearAdminSessionCookie,
  readAdminSessionFromCookie,
  ADMIN_LEGACY_COOKIE_NAME,
  mintLegacyAdminSessionToken,
  issueSupabaseAuthCookies,
  clearSupabaseAuthCookies,
  readSupabaseAccessToken,
  readSupabaseRefreshToken,
  clearAllAdminAuthCookies,
  requireLegacyAdminSession,
  requireAdminSession,
  assertAdminLoginRateLimit,
  assertReplyRateLimit,
  assertInboxFetchRateLimit,
  assertContentAiRateLimit,
  assertStaffAccountChangeRateLimit,
  assertStaffInviteRateLimit,
  assertStaffRecoveryRateLimit,
  assertStaffInviteAcceptRateLimit,
  assertStaffPasswordResetRateLimit,
  AdminAuthError,
} from "./session";
