import {
  createStart,
  createMiddleware,
  createCsrfMiddleware,
} from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { shouldRedirectForHost } from "@mccoy/security/host";

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
    protocol: protocolHeader === "http" ? "http" : url.protocol.replace(":", ""),
    app: "storefront",
  });

  if (redirect) {
    return new Response(null, {
      status: 302,
      headers: { Location: redirect.redirectTo },
    });
  }

  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, hostMiddleware, errorMiddleware],
}));
