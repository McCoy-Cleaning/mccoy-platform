export {
  findMonorepoRoot,
  readServerEnv,
  getDataDir,
} from "./env";

export {
  CANONICAL_PUBLIC_HOST,
  getHostConfig,
  resolveHostSurface,
  resolveCanonicalHostRedirect,
  shouldRedirectForHost,
  stripTrailingSlashPath,
  type CanonicalHostRedirect,
  type HostSurface,
} from "./host";

export {
  LEGACY_GONE_PATHS,
  LEGACY_PERMANENT_REDIRECTS,
  buildLegacyRedirectLocation,
  resolveLegacyHttpAction,
  resolveLegacyUrlDecision,
  type LegacyHttpAction,
  type LegacyUrlDecision,
} from "./legacy-redirects";

export {
  MAJOR_PUBLIC_CANONICAL_PATHS,
  PUBLIC_IDENTITY_ALIAS_PATHS,
  assertInternalLinkIntegrity,
  collectInternalLinkIntegrityIssues,
  evaluateInternalLinkHref,
  parseMccoyInternalHref,
  type InternalLinkIntegrityIssue,
  type InternalLinkIntegrityOptions,
  type InternalLinkIntegrityReason,
  type InternalLinkRef,
} from "./internal-link-integrity";

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

export {
  ADMIN_MFA_BROWSER_PURPOSES,
  type AdminMfaBrowserPurpose,
  type AdminMfaFlowCapability,
  MFA_FLOW_COOKIE_NAME,
  isAdminMfaBrowserPurpose,
  issueAdminMfaFlowCookie,
  readAdminMfaFlowCookie,
  clearAdminMfaFlowCookie,
  getAdminAuthCookieAttributeContract,
} from "./mfa-flow";

export { assertAdminSameOriginMutation } from "./admin-origin";
