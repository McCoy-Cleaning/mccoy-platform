/**
 * Baseline HTTP security headers for McCoy admin + storefront.
 *
 * Storefront must remain embeddable by the admin CMS preview iframe
 * (no `X-Frame-Options: DENY`, CSP `frame-ancestors` includes admin origins).
 * Admin denies framing entirely.
 */

export type SecurityHeaderApp = "admin" | "storefront";

export type SecurityHeaderOptions = {
  app: SecurityHeaderApp;
  /** Extra admin origins allowed to embed the storefront (preview / edit). */
  adminFrameAncestors?: string[];
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function defaultAdminFrameAncestors(): string[] {
  const fromEnv = [
    process.env.VITE_ADMIN_ORIGIN,
    process.env.ADMIN_ORIGIN,
    process.env.MCCOY_ADMIN_ORIGIN,
  ]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().replace(/\/$/, ""));

  // Local defaults used by Playwright / npm run dev:admin
  return unique([...fromEnv, "http://localhost:5174", "http://127.0.0.1:5174"]);
}

export function buildContentSecurityPolicy(
  app: SecurityHeaderApp,
  adminFrameAncestors: string[] = defaultAdminFrameAncestors(),
): string {
  if (app === "admin") {
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self' https: wss:",
      "form-action 'self'",
    ].join("; ");
  }

  const ancestors = unique(["'self'", ...adminFrameAncestors]);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${ancestors.join(" ")}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https: wss:",
    "form-action 'self'",
    // CMS video embeds: YouTube, Vimeo, Facebook plugins (see resolveSafeVideoEmbed)
    "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com https://web.facebook.com https://www.fb.com",
    "media-src 'self' blob: https:",
  ].join("; ");
}

export function buildSecurityHeaders(
  options: SecurityHeaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": buildContentSecurityPolicy(
      options.app,
      options.adminFrameAncestors ?? defaultAdminFrameAncestors(),
    ),
  };

  if (options.app === "admin") {
    headers["X-Frame-Options"] = "DENY";
  }

  return headers;
}

/** Clone a Response and overlay baseline security headers (does not strip existing). */
export function applySecurityHeaders(
  response: Response,
  options: SecurityHeaderOptions,
): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(buildSecurityHeaders(options))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
