/**
 * SSR-safe consent read so the banner can stay closed when the first-party
 * cookie is already set. createIsomorphicFn keeps the server import off the
 * client graph (same pattern as i18n).
 */

import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { parseAnalyticsConsentFromCookie, readAnalyticsConsent } from "./consent";

export const readInitialAnalyticsConsent = createIsomorphicFn()
  .server(() => parseAnalyticsConsentFromCookie(getRequestHeader("cookie") ?? ""))
  .client(() => readAnalyticsConsent());
