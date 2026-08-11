import {
  createStart,
  createMiddleware,
  createCsrfMiddleware,
} from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { shouldRedirectForHost } from "@mccoy/security/host";
import { resolveLegacyHttpAction } from "@mccoy/security/legacy-redirects";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Phase 2 SEO — legacy path 301/410 before host slash rewrite and page handlers.
 * Trailing-slash + apex + mapped path compose into one Location (no soft-404 hop).
 */
const legacyUrlMiddleware = createMiddleware().server(async ({ next }) => {
  const url = getRequestUrl();
  const host = getRequestHeader("host") ?? getRequestHeader("x-forwarded-host");
  const action = resolveLegacyHttpAction({
    pathname: url.pathname,
    search: url.search || "",
    host,
  });

  if (action?.kind === "gone") {
    return new Response(null, { status: 410, statusText: "Gone" });
  }
  if (action?.kind === "redirect") {
    return new Response(null, {
      status: action.status,
      headers: { Location: action.location },
    });
  }

  return next();
});

/**
 * Storefront-only host surface. `/admin*` redirects to ADMIN_HOST.
 * Authoring lives exclusively in apps/admin.
 */
const hostMiddleware = createMiddleware().server(async ({ next }) => {
  const url = getRequestUrl();
  const host = getRequestHeader("host") ?? getRequestHeader("x-forwarded-host");
  const protocolHeader = getRequestHeader("x-forwarded-proto");
  const redirect = shouldRedirectForHost({
    host,
    pathname: url.pathname,
    search: url.search || "",
    protocol: protocolHeader === "http" ? "http" : url.protocol.replace(":", ""),
    app: "storefront",
  });

  if (redirect) {
    return new Response(null, {
      status: redirect.status ?? 302,
      headers: { Location: redirect.redirectTo },
    });
  }

  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    legacyUrlMiddleware,
    hostMiddleware,
    errorMiddleware,
  ],
}));
