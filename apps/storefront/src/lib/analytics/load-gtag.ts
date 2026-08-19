/**
 * Imperative GA4 (gtag) loader. Call only after analytics consent is granted.
 * Idempotent for a given measurement ID within the page lifetime.
 *
 * Consent Mode v2: default denied is applied before any config. Accept updates
 * analytics_storage to granted, then loads gtag.js and sends page_view.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const initializedIds = new Set<string>();
const lastPagePathById = new Map<string, string>();
const pendingPageViewById = new Map<
  string,
  { measurementId: string; pathname: string; title?: string }
>();
let consentDefaultApplied = false;

const DENIED_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  wait_for_update: 500,
} as const;

function ensureGtagStub(): boolean {
  if (typeof window === "undefined") return false;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    // Google's snippet uses `arguments`. A rest-parameter Array is queued as
    // one value; gtag.js then ignores consent/config/page_view and never
    // sends collect.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }
  return true;
}

/** Consent Mode v2 default — before any gtag config. Does not load gtag.js. */
export function applyGoogleConsentDefault(): boolean {
  if (!ensureGtagStub()) return false;
  if (consentDefaultApplied) return false;
  window.gtag!("consent", "default", { ...DENIED_CONSENT });
  consentDefaultApplied = true;
  return true;
}

/** Accept: update analytics_storage only. Ads stay denied. */
export function updateGoogleAnalyticsConsentGranted(): boolean {
  if (!ensureGtagStub()) return false;
  applyGoogleConsentDefault();
  window.gtag!("consent", "update", { analytics_storage: "granted" });
  return true;
}

function flushPendingPageView(measurementId: string): void {
  const pending = pendingPageViewById.get(measurementId);
  if (!pending) return;
  pendingPageViewById.delete(measurementId);
  lastPagePathById.delete(measurementId);
  sendGoogleAnalyticsPageView(pending);
}

export function loadGoogleAnalyticsGtag(measurementId: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  applyGoogleConsentDefault();
  if (initializedIds.has(measurementId)) return false;

  window.gtag!("js", new Date());
  window.gtag!("config", measurementId, {
    anonymize_ip: true,
    send_page_view: false,
  });

  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-mccoy-ga4="${measurementId}"]`,
  );
  if (!existing) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.mccoyGa4 = measurementId;
    script.onload = () => {
      flushPendingPageView(measurementId);
    };
    document.head.appendChild(script);
  }
  initializedIds.add(measurementId);
  // First explicit page_view after init must not be dropped by the dedupe map.
  lastPagePathById.delete(measurementId);
  return true;
}

function pageLocation(pathname: string): string {
  const origin =
    typeof window.location?.origin === "string" &&
    /^https?:\/\//i.test(window.location.origin)
      ? window.location.origin
      : "https://www.mccoy.nl";
  return new URL(pathname, origin).href;
}

/**
 * Explicit SPA page view. Search/hash are deliberately excluded so form or
 * campaign query values cannot accidentally become analytics payload data.
 */
export function sendGoogleAnalyticsPageView(input: {
  measurementId: string;
  pathname: string;
  title?: string;
}): boolean {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return false;
  if (!initializedIds.has(input.measurementId)) return false;
  const pathname = input.pathname.startsWith("/") ? input.pathname.split(/[?#]/, 1)[0]! : "/";
  if (lastPagePathById.get(input.measurementId) === pathname) return false;
  lastPagePathById.set(input.measurementId, pathname);
  window.gtag("event", "page_view", {
    page_path: pathname,
    page_location: pageLocation(pathname),
    page_title: input.title ?? document.title,
    send_to: input.measurementId,
  });
  return true;
}

/**
 * Same-turn accept: consent update → load gtag.js → first page_view.
 */
export function activateGoogleAnalyticsAfterConsent(input: {
  measurementId: string;
  pathname: string;
  title?: string;
}): boolean {
  updateGoogleAnalyticsConsentGranted();
  pendingPageViewById.set(input.measurementId, {
    measurementId: input.measurementId,
    pathname: input.pathname,
    title: input.title,
  });
  loadGoogleAnalyticsGtag(input.measurementId);
  return sendGoogleAnalyticsPageView({
    measurementId: input.measurementId,
    pathname: input.pathname,
    title: input.title,
  });
}

/** Exempt routes form a navigation boundary but never emit an event. */
export function resetGoogleAnalyticsPageViewDedupe(measurementId: string): void {
  lastPagePathById.delete(measurementId);
}

/** Test helper — clears in-memory load guard. */
export function resetGtagLoadStateForTests(): void {
  initializedIds.clear();
  lastPagePathById.clear();
  pendingPageViewById.clear();
  consentDefaultApplied = false;
}
