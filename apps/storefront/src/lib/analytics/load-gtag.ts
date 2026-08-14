/**
 * Imperative GA4 (gtag) loader. Call only after analytics consent is granted.
 * Idempotent for a given measurement ID within the page lifetime.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const initializedIds = new Set<string>();
const lastPagePathById = new Map<string, string>();

export function loadGoogleAnalyticsGtag(measurementId: string): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (initializedIds.has(measurementId)) return false;

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  }
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
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
    document.head.appendChild(script);
  }
  initializedIds.add(measurementId);
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

/** Exempt routes form a navigation boundary but never emit an event. */
export function resetGoogleAnalyticsPageViewDedupe(measurementId: string): void {
  lastPagePathById.delete(measurementId);
}

/** Test helper — clears in-memory load guard. */
export function resetGtagLoadStateForTests(): void {
  initializedIds.clear();
  lastPagePathById.clear();
}
