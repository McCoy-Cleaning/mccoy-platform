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

/** Split comma/space-separated origin lists from env (staging + preview hosts). */
function originsFromEnvValue(value: string | undefined): string[] {
  if (!value || !value.trim()) return [];
  return value
    .split(/[\s,]+/)
    .map((v) => v.trim().replace(/\/$/, ""))
    .filter((v) => {
      if (!v) return false;
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    });
}

function defaultAdminFrameAncestors(): string[] {
  const fromEnv = [
    ...originsFromEnvValue(process.env.MCCOY_ADMIN_FRAME_ANCESTORS),
    ...originsFromEnvValue(process.env.VITE_ADMIN_ORIGIN),
    ...originsFromEnvValue(process.env.ADMIN_ORIGIN),
    ...originsFromEnvValue(process.env.MCCOY_ADMIN_ORIGIN),
  ];

  // Local defaults used by Playwright / npm run dev:admin
  return unique([...fromEnv, "http://localhost:5174", "http://127.0.0.1:5174"]);
}

/**
 * Storefront origins the admin CMS may embed (`frame-src`), probe
 * (`connect-src`, e.g. edit-canvas reachability fetch), and load CMS
 * project thumbnails from (`img-src`).
 * Without an explicit `frame-src`, CSP falls back to `default-src 'self'` and
 * blocks cross-origin www — the iframe stays blank.
 * Without matching `connect-src` / `img-src` entries, http://localhost
 * storefront probes and `/images/...` thumbnails fail even when `https:` is
 * allowed (http local origins are not covered by the bare `https:` token).
 */
function defaultAdminStorefrontOrigins(): string[] {
  const fromEnv = [
    ...originsFromEnvValue(process.env.MCCOY_STOREFRONT_FRAME_SRC),
    ...originsFromEnvValue(process.env.VITE_STOREFRONT_ORIGIN),
    ...originsFromEnvValue(process.env.STOREFRONT_ORIGIN),
    ...originsFromEnvValue(process.env.MCCOY_STOREFRONT_ORIGIN),
  ];
  return unique([
    ...fromEnv,
    "https://www.mccoy.nl",
    "https://mccoy.nl",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
}

/**
 * Browser uploads (signed storage URLs), Auth, and Realtime talk to the
 * configured Supabase project — never a hardcoded project ref.
 * `https://*.supabase.co` / `wss://*.supabase.co` cover hosted projects when
 * env is missing at header-build time (do not use bare `https:` / `wss:`).
 */
function supabaseConnectSrcOrigins(): string[] {
  const exact = unique([
    ...originsFromEnvValue(process.env.SUPABASE_URL),
    ...originsFromEnvValue(process.env.VITE_SUPABASE_URL),
  ]);
  const sockets: string[] = [];
  for (const origin of exact) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "https:") sockets.push(`wss://${parsed.host}`);
      else if (parsed.protocol === "http:") sockets.push(`ws://${parsed.host}`);
    } catch {
      // originsFromEnvValue already validates http(s) URLs.
    }
  }
  return unique([
    ...exact,
    ...sockets,
    "https://*.supabase.co",
    "wss://*.supabase.co",
  ]);
}

export function buildContentSecurityPolicy(
  app: SecurityHeaderApp,
  adminFrameAncestors: string[] = defaultAdminFrameAncestors(),
): string {
  if (app === "admin") {
    const storefrontOrigins = defaultAdminStorefrontOrigins();
    const frameSrc = unique(["'self'", ...storefrontOrigins]);
    // Same storefront origins as frame-src so CMS reachability probes and
    // project-photo thumbnails work against local http:// storefronts
    // (https: does not cover http localhost).
    const connectSrc = unique(["'self'", "https:", "wss:", ...storefrontOrigins]);
    const imgSrc = unique(["'self'", "data:", "blob:", "https:", ...storefrontOrigins]);
    return [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `img-src ${imgSrc.join(" ")}`,
      // Google Fonts CSS + files (admin __root.tsx stylesheet link).
      "font-src 'self' data: https: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // vercel.live = Vercel preview feedback toolbar (not Web Analytics).
      "script-src 'self' 'unsafe-inline' https://vercel.live",
      `connect-src ${connectSrc.join(" ")}`,
      "form-action 'self'",
      // CMS edit/preview embeds the storefront (often a different origin).
      `frame-src ${frameSrc.join(" ")}`,
    ].join("; ");
  }

  const ancestors = unique(["'self'", ...adminFrameAncestors]);
  const connectSrc = unique([
    "'self'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://analytics.google.com",
    "https://vitals.vercel-insights.com",
    "https://vercel.live",
    "wss://ws-us3.pusher.com",
    ...supabaseConnectSrcOrigins(),
  ]);
  const frameSrc = unique([
    "'self'",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
    "https://www.facebook.com",
    "https://web.facebook.com",
    "https://www.fb.com",
    // Vercel preview feedback toolbar iframe.
    "https://vercel.live",
  ]);
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `frame-ancestors ${ancestors.join(" ")}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // GA4 gtag (consent-gated in storefront) + Vercel Analytics / preview toolbar.
    "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com https://www.googletagmanager.com https://www.google-analytics.com",
    // Same-origin app/server functions + explicit analytics/preview telemetry
    // + configured Supabase (form signed uploads). Do not use bare https:/wss:
    // that would let injected scripts exfiltrate anywhere.
    `connect-src ${connectSrc.join(" ")}`,
    "form-action 'self'",
    // CMS video embeds: YouTube, Vimeo, Facebook plugins (see resolveSafeVideoEmbed)
    `frame-src ${frameSrc.join(" ")}`,
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
